class Counter:
    def __init__(self, value):
        self.value = value
    def add(self, amount):
        self.value = self.value + amount
        return self.value

class Multiplier:
    def __init__(receiver, value):
        receiver.value = value
    def add(receiver, amount):
        receiver.value = receiver.value * amount
        return receiver.value

def apply(value, amount):
    return value.add(amount)

first = Counter(10)
alias = first
second = Counter(100)
other = Multiplier(3)
print(apply(first, 7))
print(alias.value)
print(second.value)
print(apply(other, 4))
print(Counter("é").add("𝄞"))
print(Counter(b"A").add(b"\xff"))
print(Counter(1234567890123456789012345678901234567890).add(1))
