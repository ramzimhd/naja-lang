def choose(flag):
    if flag:
        return 7
    else:
        value = 9
    return value

def scan(limit):
    index = 0
    while index < limit:
        if index == 2:
            return index
        index = index + 1
    return -1

def both(flag):
    if flag:
        return "yes"
    else:
        return "no"
    print("unreachable")

print(choose(True))
print(choose(False))
print(scan(4))
print(scan(0))
print(both(True))
print(both(False))
