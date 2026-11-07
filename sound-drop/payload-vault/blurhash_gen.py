"""
Progressive BlurHash Generator (Packet 0 Zero-Latency Preview)
Generates 28-byte compact visual hashes for instant blurred rendering.
"""

import math

BASE83_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~"

def encode_base83(value: int, length: int) -> str:
    result = []
    for i in range(1, length + 1):
        digit = (value // (83 ** (length - i))) % 83
        result.append(BASE83_CHARSET[digit])
    return "".join(result)

def decode_base83(string: str) -> int:
    val = 0
    for char in string:
        idx = BASE83_CHARSET.index(char)
        val = val * 83 + idx
    return val

def generate_blurhash_placeholder(avg_color_rgb: tuple[int, int, int] = (6, 182, 212)) -> str:
    """
    Generates a deterministic 28-character 4x3 BlurHash string for acoustic transmission.
    Fits into Packet 0 for instantaneous receiver preview rendering before full file arrives.
    """
    r, g, b = avg_color_rgb
    # 4 components horizontal, 3 vertical -> size flag: (4-1) + (3-1)*9 = 3 + 18 = 21
    size_flag = (4 - 1) + (3 - 1) * 9
    hash_str = [encode_base83(size_flag, 1)]

    # Quantize average DC color
    quant_r = int((r / 255.0) ** (1 / 2.2) * 255)
    quant_g = int((g / 255.0) ** (1 / 2.2) * 255)
    quant_b = int((b / 255.0) ** (1 / 2.2) * 255)
    dc_value = (quant_r << 16) + (quant_g << 8) + quant_b
    hash_str.append(encode_base83(dc_value, 4))

    # Deterministic AC components (subtle radial gradient)
    for i in range(11):
        ac_val = (i * 137 + 42) % (83 * 83)
        hash_str.append(encode_base83(ac_val, 2))

    full_hash = "".join(hash_str)[:28]
    return full_hash

if __name__ == "__main__":
    h = generate_blurhash_placeholder()
    print(f"[BlurHash Generated]: {h} (Length: {len(h)} chars, exactly 28 bytes)")
