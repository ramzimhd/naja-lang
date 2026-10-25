def identity(value):
    return value

def update(values):
    values[1][0] = 7
    return values[0]

values = [[0, 1], [2, 3]]
alias = values
child = update(values)
child[-1] = True
identity(values)[0][0] = "changed"
print(alias[0][0])
print(alias[0][1])
print(values[1][0])
values = [99]
print(len(alias))
print(values[0])
(child[0]) = None
print(alias[0][0])
