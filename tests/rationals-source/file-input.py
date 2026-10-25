from naja.io import read_bytes
from naja.numeric import rational, numerator, denominator

data = read_bytes("operands.bin")
value = rational(data[0] - 128, data[1] - 128)
print(numerator(value))
print(denominator(value))
