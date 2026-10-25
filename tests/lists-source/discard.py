def mark(label, value):
    print(label)
    return value

[mark("discarded list", 1)]
(mark("discarded tuple", 2),)
mark("discarded scalar", 3)
False and [len(1)]
True or [][0]
print(3 < 2 < [])
if []:
    print("unreachable")
else:
    print("empty is false")
if [False]:
    print("nonempty is true")
print(len([] and mark("unreachable and", [1])))
print(len([False] or mark("unreachable or", [])))
