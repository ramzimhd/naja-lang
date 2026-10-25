def mark(label, value):
    print(label)
    return value

print(None == mark("middle None", None) in mark("None container", {None: 7}))
print(8 > mark("middle integer", 7) in mark("integer container", {7}))
print("é" == mark("middle text", "é") in {"é": None})
print(1 not in mark("nonempty middle", {1}) == len(1))
print(1 in mark("false middle", {}) == len(1))
print(3 < 2 < len(1) in {})
print(False and 1 in len(1))
print(True or 1 in len(1))
print(not 1 in {})
print(1 in {} or 2 in {2})
print(1 + 2 in {3} and 4 not in {3})
