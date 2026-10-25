def pair(first, second):
    return (first, second)

def identity(value):
    return value

def none():
    pass

original = ("old", (True, b"\xff"))
alias = original
view = original[1]
original = ("new",)
print(alias[0])
print(view[0])
print(view[1][0])
print(pair(7, 8)[1])
print(pair(7, 8,)[0])
print(len(identity((1, 2))))
print(identity((True,))[0])
print(len(identity(())))
print(none())
