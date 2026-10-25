class Counter:
    def __init__(self, value):
        self.value = value
    def add(self, amount):
        self.value = self.value + amount
        return self.value

def shadow(value):
    value.add = 0
    return 7

def replace(holder):
    holder[0] = Counter(99)
    return 5

first = Counter(1)
print(first.add(shadow(first)))
print(first.add)
holder = [Counter(1)]
old = holder[0]
print(holder[0].add(replace(holder)))
print(old.value)
print(holder[0].value)
