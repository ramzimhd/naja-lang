def identity(value):
    return value

def bare():
    return

def missing():
    pass

def quiet():
    print("discarded call")

print(identity(12345678901234567890123456789012345678901234567890))
print(identity("é𝄞"))
print(identity(b"A\x00\xff"))
print(identity(True))
print(identity(False))
print(identity(None))
print(bare())
print(missing())
quiet()
print(quiet())
