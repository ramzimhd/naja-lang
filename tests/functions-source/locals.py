def sum_to(n):
    saved = n
    if n == 0:
        return 0
    child = sum_to(n - 1)
    assert saved == n
    return child + saved

def first(value):
    local = value + 100
    return local

def second(value):
    local = value + 200
    return first(local) + local

saved = 999
local = "module local"
print(sum_to(20))
print(second(3))
print(saved)
print(local)
