class Node:
    pass

def connect(first, second):
    first.next = second
    return first.next

first = Node()
second = Node()
first.next = first
print(first.next.next == first)
connect(first, second)
connect(second, first)
print(first.next.next == first)
first.value = [True]
alias = first.next.next
alias.value[0] = False
print(first.value[0])
print(second.next == first)
print(not first)
