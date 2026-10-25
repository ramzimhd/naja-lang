from naja.io import read_bytes, write_bytes

data = read_bytes("input.bin")
print(len(data))
print(write_bytes("output.bin", data))
print(len(read_bytes("output.bin")))
