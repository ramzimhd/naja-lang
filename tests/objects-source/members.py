def helper(value):
    return value + 10

class Message:
    def __init__(this, value):
        this.value = value
    def print(this, value):
        return helper(value)
    def i64(this, value):
        return value + 1
    def first(this):
        return this.later()
    def later(this):
        return this.value
    def clone(this, value):
        return Message(value)

value = Message("é𝄞")
print(value.print(3))
print(value.i64(3))
print(value.first())
print(value.clone("new").value)
value.Key = 7
print(value.Key)
value.Key = True
print(value.Key)
value.é = "canonical"
print(value.é)
