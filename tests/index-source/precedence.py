def identity(value):
    return value

print(-b"\x03\x04"[1])
print(+b"\x03\x04"[False])
print(2 + b"\x03\x04"[1] * 3)
print(b"\x09"[0] // 2)
print(b"\x09"[0] % 2)
print(("a" + "é𝄞")[1])
print(identity("é𝄞")[1][0])
print("xyz"[2 - 1])
print("xyz"[-1 - 1])
print("xyz"[False or True])
print(not "x"[0])
print("x"[0] == "x" and b"\xff"[0] > 254)
