def mark(label, value):
    print(label)
    return value

def combine(a, b, c):
    return a * 100 + b * 10 + c

def wrap(value):
    return value + 1

print(combine(mark("first", 1), wrap(mark("second", 1)), mark("third", 3)))
print(combine(mark("outer first", 4), combine(mark("inner first", 0), mark("inner second", 0), mark("inner third", 5)), mark("outer last", 6)))
