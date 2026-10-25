from naja.io import read_bytes as first, read_bytes as second
from naja.io import read_bytes as third
from naja.text import (
    encode_utf8 as ｉｆ,
    decode_utf8 as decode,
)

print(len(first("input.bin")))
print(second("input.bin") == third("input.bin"))
print(decode(ｉｆ("κόσμος")))
