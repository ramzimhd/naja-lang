values = [None, True]
values[0] = values
print(len(values[0][0][0]))
print(values[0][1])
other = [values]
values[0] = other
print(len(values[0]))
print(len(values[0][0]))
print(values[0][0][1])
alias = values[0][0]
alias[1] = "shared cycle"
print(other[0][1])
print(not values)
