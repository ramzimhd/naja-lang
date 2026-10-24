from naja.core import i64

# An explicit fixed-width seed spike, not a hosted arbitrary-integer example.
index: i64 = i64(0)
total: i64 = i64(0)
while index < i64(10):
    total = total + index * i64(2)
    index = index + i64(1)
if total == i64(90):
    print(total)
else:
    print(i64(-1))
