# Identifier normalization preserves the original multilingual source bytes.
def Key(δ):
    return δ + 1

def café(値):
    return Key(値)

def ｒｅｔｕｒｎ(value):
    return value

print(Key(41))
print(café(5))
print(ｒｅｔｕｒｎ("κόσμος"))
