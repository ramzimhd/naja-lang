from naja.numeric import rational, divide_exact, numerator, denominator

def mark(label, value):
    print(label)
    return value

value = rational(mark("numerator", 6), mark("denominator", 8))
print(numerator(value))
print(denominator(value))
value = divide_exact(mark("left", value), mark("right", rational(9, 4)))
print(numerator(value))
print(denominator(value))
print(rational(1, 4) < mark("middle", rational(1, 2)) < mark("last", 1))
print(rational(2, 1) < mark("false middle", 1) < len(1))
print(False and rational(1, 0))
print(True or divide_exact(1, 0))
value = mark("add left", rational(1, 3)) + mark("add right", rational(1, 6))
print(numerator(value))
print(denominator(value))
