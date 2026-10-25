from naja.io import read_bytes
from naja.text import decode_utf8

value = {"K\n": "ASCII", "K\n": "compatibility"}
key = decode_utf8(read_bytes("key.txt"))
print(value[key])
