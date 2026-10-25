def mark(label, value):
    print(label)
    return value

class Pair:
    def __init__(self, first, second):
        print("init")
        self.first = first
        self.second = second
    def combine(self, first, second):
        return first + second

value = Pair(mark("first constructor argument", 1), mark("second constructor argument", 2))
mark("object", value).first = mark("assigned value", 7)
print(value.first)
print(mark("receiver", value).combine(mark("first method argument", 3), mark("second method argument", 4)))

class Holder:
    pass

holder = Holder()
holder.items = [value]
mark("nested object", holder).items[0].second = mark("nested value", True)
print(value.second)
