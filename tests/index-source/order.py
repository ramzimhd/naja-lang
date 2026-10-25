def mark(label, value):
    print(label)
    return value

def sequence(depth):
    print(depth)
    if depth == 0:
        return "Aé𝄞"
    return sequence(depth - 1)

def index():
    print("index call")
    return 1

print(mark("sequence", "abc")[mark("index", 1)])
print(sequence(2)[index()])
print(mark("byte sequence", b"\x00\xff")[mark("byte index", -1)])
print(mark("chained sequence", "é𝄞")[mark("first index", 1)][mark("second index", 0)])
