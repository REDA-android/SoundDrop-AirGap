"""
Air-Gap Acoustic Packager & Brotli/Deflate Chunking
Transforms arbitrary files, text, and images into 64-byte acoustic packets.
"""

import zlib
import struct
import math
from typing import List, Optional
from blurhash_gen import generate_blurhash_placeholder
from crypto_box import seal_payload, unseal_payload

CHUNK_SIZE = 64

class AirgapPacket:
    def __init__(
        self,
        session_id: int,
        packet_idx: int,
        total_packets: int,
        payload_type: int,
        flags: int,
        payload_bytes: bytes,
    ):
        self.session_id = session_id & 0xFF
        self.packet_idx = packet_idx & 0xFF
        self.total_packets = total_packets & 0xFF
        self.payload_type = payload_type & 0xFF
        self.flags = flags & 0xFF
        self.payload_bytes = payload_bytes

    def serialize(self) -> bytes:
        # [SyncWord: 0xAA55 (2B)] + [Type(1B), Session(1B), Index(1B), Total(1B), Len(1B), Flags(1B)] + Payload + CRC32(4B)
        hdr = struct.pack(
            ">HBBBBBB",
            0xAA55,
            self.payload_type,
            self.session_id,
            self.packet_idx,
            self.total_packets,
            len(self.payload_bytes),
            self.flags,
        )
        body = hdr + self.payload_bytes
        crc = zlib.crc32(body) & 0xFFFFFFFF
        return body + struct.pack(">I", crc)

    @classmethod
    def deserialize(cls, data: bytes) -> Optional["AirgapPacket"]:
        if len(data) < 12:
            return None
        sync, p_type, s_id, p_idx, t_pkts, p_len, flags = struct.unpack(">HBBBBBB", data[:8])
        if sync != 0xAA55:
            return None
        crc_expected, = struct.unpack(">I", data[-4:])
        if (zlib.crc32(data[:-4]) & 0xFFFFFFFF) != crc_expected:
            return None
        return cls(s_id, p_idx, t_pkts, p_type, flags, data[8:8 + p_len])

def package_file_or_text(
    data: bytes,
    session_id: int,
    is_image: bool = False,
    pin: Optional[str] = None
) -> List[AirgapPacket]:
    flags = 0
    payload_to_chunk = data

    # 1. Encrypt if pin specified
    if pin:
        payload_to_chunk = seal_payload(payload_to_chunk, pin)
        flags |= 0x04 # Bit 2: Encrypted

    # 2. Deflate compression
    compressed = zlib.compress(payload_to_chunk, level=9)[2:-4]
    if len(compressed) < len(payload_to_chunk):
        payload_to_chunk = compressed
        flags |= 0x01 # Bit 0: Compressed

    total_len = len(payload_to_chunk)
    total_pkts = max(1, math.ceil(total_len / CHUNK_SIZE))

    packets = []

    # If image, prepend Packet 0 carrying 28-byte BlurHash
    if is_image:
        total_pkts += 1
        bh_str = generate_blurhash_placeholder()
        bh_bytes = bh_str.encode("utf-8")
        pkt0 = AirgapPacket(
            session_id=session_id,
            packet_idx=0,
            total_packets=total_pkts,
            payload_type=3, # Image
            flags=flags | 0x08, # Bit 3: BlurHash P0
            payload_bytes=bh_bytes,
        )
        packets.append(pkt0)

    for i in range(len(packets), total_pkts):
        offset = (i - (1 if is_image else 0)) * CHUNK_SIZE
        chunk = payload_to_chunk[offset:offset + CHUNK_SIZE]
        pkt = AirgapPacket(
            session_id=session_id,
            packet_idx=i,
            total_packets=total_pkts,
            payload_type=3 if is_image else 1,
            flags=flags,
            payload_bytes=chunk,
        )
        packets.append(pkt)

    return packets

if __name__ == "__main__":
    test_data = b"AIRGAP_CONFIDENTIAL_DROP_VERIFIED_100%"
    pkts = package_file_or_text(test_data, session_id=7, is_image=True, pin="1234")
    assert len(pkts) >= 2
    raw = pkts[0].serialize()
    recovered = AirgapPacket.deserialize(raw)
    assert recovered is not None
    assert recovered.session_id == 7
    print(f"[PASS] Packager sliced {len(test_data)} bytes into {len(pkts)} packets with BlurHash P0.")
