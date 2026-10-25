def mark(label, value):
    print(label)
    return value

print(False and ""[0])
print(True or b""[0])
if False:
    print(None[mark("unreachable branch", 0)])
print(3 < 2 < ""[mark("unreachable chain", 0)])
print(mark("first", "a")[0] < mark("middle", "b")[0] < mark("last", "c")[0])
print(mark("failed first", "c")[0] < mark("failed middle", "b")[0] < mark("unreachable tail", "a")[0])
