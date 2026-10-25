def mark(label, value):
    print(label)
    return value

print(False and (len(1),))
print(True or ()[0])
print(3 < 2 < ())
print(len(() and mark("unreachable empty and", (1,))))
print(len((False,) or mark("unreachable tuple or", ())))
if ():
    print(()[mark("unreachable branch", 0)])
else:
    print("empty is false")
if (None,):
    print("nonempty is true")
