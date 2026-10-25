from naja.io import read_bytes, write_bytes
from naja.text import encode_utf8, decode_utf8

def mark(label, value):
    print(label)
    return value

print(write_bytes(mark("path", "output.bin"), mark("data", b"abc")))
print(decode_utf8(mark("decode", read_bytes(mark("read path", "output.bin")))))
print(len(encode_utf8(mark("encode", "é𝄞"))))
