def identity(value):
    return value

first = {"value": None}
first["self"] = first
first["self"]["self"]["value"] = True
print(first["value"])
second = {"parent": first}
first["child"] = second
identity(first)["child"]["parent"]["value"] = [None]
alias = first["value"]
alias[0] = False
print(second["parent"]["value"][0])
class Holder:
    def __init__(self, value):
        self.value = value
    def keys(self):
        return self.value

holder = Holder(first)
holder.keys()["value"][0] = True
print(first["value"][0])
print(len({"set": {1, 2}}["set"]))
