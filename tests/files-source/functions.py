from naja.io import (read_bytes as 読む, write_bytes as 書く,)
from naja.text import (encode_utf8 as 符号化, decode_utf8 as 復号,)

def roundtrip(path, output):
    value = 復号(読む(path))
    書く(output, 符号化(value))
    return value

def shadow(読む):
    return 読む

print(roundtrip("input.bin", "output.bin"))
print(shadow(True))
