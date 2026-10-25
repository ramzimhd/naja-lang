from naja.numeric import rational, numerator, denominator

def identity(value):
    return value

class Holder:
    def __init__(self, value):
        self.value = value
    def numerator(self):
        return self.value

value = rational(6, 8)
alias = value
value = rational(1, 3)
print(numerator(alias))
print(denominator(alias))
print(numerator(value))
holder = Holder(alias)
items = [holder.numerator(), rational(-1, 7)]
mapping = {"ratio": (items,)}
identity(mapping)["ratio"][0][1] = value
print(numerator(mapping["ratio"][0][0]))
print(denominator(mapping["ratio"][0][1]))
holder.value = items[1] + True
print(numerator(holder.value))
print(denominator(holder.value))
print(numerator(+holder.value))
print(numerator(-holder.value))
