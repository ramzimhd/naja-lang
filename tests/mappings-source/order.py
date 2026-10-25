from naja.collections import keys_snapshot

def mark(label, value):
    print(label)
    return value

value = {mark("first key", 1): mark("first value", 7), mark("second key", 2): mark("second value", 8)}
print(mark("read container", value)[mark("read key", 1)])
mark("store container", value)[mark("store key", 2)] = mark("stored value", True)
print(value[2])
print(mark("element", 2) in mark("membership container", value))
print(keys_snapshot(mark("snapshot container", value))[1])
print(len({mark("set first", 1), mark("set duplicate", True), mark("set last", None)}))

def replace(holder):
    holder[0] = {}
    return "new"

holder = [{"old": 1}]
old = holder[0]
holder[0]["selected"] = replace(holder)
print(holder[0]["selected"])
print("selected" not in old)
