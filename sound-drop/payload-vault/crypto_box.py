"""
Authenticated Acoustic Cryptographic Envelope
Protects payload bytes using authenticated envelope encryption with zero network dependency.
"""

import hashlib
import hmac
import os
import struct

def derive_keys(passphrase: str, salt: bytes) -> tuple[bytes, bytes]:
    """Derives 32-byte encryption key + 32-byte HMAC key."""
    km = hashlib.pbkdf2_hmac(
        "sha256",
        passphrase.encode("utf-8"),
        salt,
        iterations=50000,
        dklen=64
    )
    return km[:32], km[32:]

def seal_payload(plaintext: bytes, pin: str) -> bytes:
    """
    Seals plaintext: [Salt: 8B] + [Nonce: 8B] + Ciphertext + [Tag: 16B]
    """
    salt = os.urandom(8)
    nonce = os.urandom(8)
    enc_key, hmac_key = derive_keys(pin, salt)

    # Deterministic stream cipher blocks
    keystream = bytearray()
    counter = 0
    while len(keystream) < len(plaintext):
        block = hashlib.sha256(enc_key + nonce + struct.pack(">Q", counter)).digest()
        keystream.extend(block)
        counter += 1

    ciphertext = bytes([p ^ k for p, k in zip(plaintext, keystream[:len(plaintext)])])
    tag = hmac.new(hmac_key, salt + nonce + ciphertext, hashlib.sha256).digest()[:16]
    return salt + nonce + ciphertext + tag

def unseal_payload(sealed_envelope: bytes, pin: str) -> bytes:
    """Verifies authentication tag and unseals plaintext."""
    if len(sealed_envelope) < 32:
        raise ValueError("Invalid envelope: too short")

    salt = sealed_envelope[:8]
    nonce = sealed_envelope[8:16]
    tag = sealed_envelope[-16:]
    ciphertext = sealed_envelope[16:-16]

    enc_key, hmac_key = derive_keys(pin, salt)
    expected_tag = hmac.new(hmac_key, salt + nonce + ciphertext, hashlib.sha256).digest()[:16]
    if not hmac.compare_digest(tag, expected_tag):
        raise ValueError("MAC Verification Failed: Tampered frame or invalid PIN")

    keystream = bytearray()
    counter = 0
    while len(keystream) < len(ciphertext):
        block = hashlib.sha256(enc_key + nonce + struct.pack(">Q", counter)).digest()
        keystream.extend(block)
        counter += 1

    return bytes([c ^ k for c, k in zip(ciphertext, keystream[:len(ciphertext)])])

if __name__ == "__main__":
    msg = b"AIRGAP_CONFIDENTIAL_PAYLOAD_2026"
    pin = "9941"
    sealed = seal_payload(msg, pin)
    unsealed = unseal_payload(sealed, pin)
    assert unsealed == msg
    print("[PASS] Authenticated Crypto Box verified successfully.")
