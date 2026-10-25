def pick(sequence, index):
    return sequence[index]

def returned_view():
    original = "old𝄞é"
    view = original[3]
    original = "new"
    return view

original = "A𝄞é"
alias = original
view = original[1]
original = "replacement"
print(alias)
print(view)
print(view[0])
print(returned_view())
print(pick("é𝄞", -1))
original_bytes = b"A\x00\xff"
bytes_alias = original_bytes
original_bytes = b"new"
print(bytes_alias[-1])
print(pick(bytes_alias, 1))
