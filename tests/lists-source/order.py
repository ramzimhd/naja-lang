def mark(label, value):
    print(label)
    return value

values = [mark("first child", 1), mark("second child", 2)]
mark("sequence", values)[mark("index", 0)] = mark("value", 7)
outer = [values]
mark("outer sequence", outer)[mark("inner index", 0)][mark("outer index", 1)] = mark("nested value", True)
print(values[0])
print(values[1])

def replace(holder):
    holder[0] = [9]
    return 17

holder = [[0]]
old = holder[0]
holder[0][0] = replace(holder)
print(old[0])
print(holder[0][0])
