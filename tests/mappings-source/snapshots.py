from naja.collections import (keys_snapshot as snapshot,)

value = {True: "old", "K": None, "K": False, "é": True, "é": 7}
first = snapshot(value)
value[1] = "new"
value["later"] = [None]
value["later"][0] = True
second = snapshot(value)
print(len(first))
print(len(second))
print(first[0])
print(second[0])
print(first[1])
print(first[2])
print(first[3])
print(first[4])
print(second[-1])
print(value[True])
print(value["later"][0])
print(not value)
print(not {None})
