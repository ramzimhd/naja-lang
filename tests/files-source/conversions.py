from naja.text import encode_utf8, decode_utf8

text = "é𝄞e\u0301\0"
encoded = encode_utf8(text)
text = "replacement"
print(len(encoded))
print(decode_utf8(encoded))
original = b"A\x00"
decoded = decode_utf8(original)
original = b"replacement"
print(decoded)
print(len(encode_utf8("e\u0301")))
print(len(encode_utf8("é")))
