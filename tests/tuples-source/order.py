def mark(label, value):
    print(label)
    return value

def sequence(depth):
    print(depth)
    if depth == 0:
        return ("é", "𝄞")
    return sequence(depth - 1)

def index():
    print("index")
    return 1

values = (mark("first", 11), mark("second", (mark("nested", True),)), mark("third", 33))
print(values[0])
print(values[1][0])
print(values[2])
print(sequence(2)[index()])
print(mark("sequence", (1, 2))[mark("index argument", False)])
