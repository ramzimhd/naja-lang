class Empty: pass

value = Empty()
print(not value)
print(value and "truthy")
print((value or len(1)) == value)
print(False and value.missing)
print(True or value.missing())
print(3 < 2 < value.missing)
if False:
    value.missing()
if value:
    print("empty instance is true")
