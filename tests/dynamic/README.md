# Native dynamic value foundation

`naja_native::dynamic` emits Linux x86-64 machine code and ELF directly from its
internal Rust IR. There is no bytecode dispatch loop, external compiler/linker,
foreign interpreter, embedded seed compiler or result service in emitted code.
This is an experimental B0 construction slice, not FC1 or HATCH completion.
The shared frontend and parser are separate integration work.

The IR supports immutable `Integer(String)`, `Text(String)`, `Bytes(Vec<u8>)`,
`Boolean(bool)`, `None`, local references, unary negation/positive, `Len`,
`RequireInteger`, `Binary` addition, subtraction and multiplication, `Compare`,
`CompareChain`, `Not`, `And`, and `Or`. Statements
assign a local, print, assert a truthy expression, branch, loop, or group a suite.
`validate` rejects invalid decimal spelling, uninitialized/out-of-frame reads,
more than 128 locals, 128 expression levels, 64 suite levels, 10000 combined IR
nodes or 1 MiB of aggregate integer/text/bytes literal data. Loop-body assignment
does not initialize a local after a possibly unexecuted loop; branches intersect
their initialized locals. A comparison chain requires 1..128 comparator entries;
every comparison operation and operand consumes the global node budget, even in
a branch that will be skipped at runtime. All unary operands consume the same
depth/node/literal budgets. No source rewriting or integer narrowing occurs.

Integer payloads use the existing hosted immutable sign/magnitude base-1e9
objects and exactly the same native arithmetic kernels. Boolean numeric operands
act as integer zero or one; arithmetic, including negation, returns an integer.
Unary positive preserves exact integer values and converts Bool to Int without
changing its zero/one value. `RequireInteger` returns an original Int or Bool
descriptor unchanged; it rejects other kinds with type failure 105. This is a
temporary internal boundary check for the parser, not a general type system or
implicit conversion mechanism.
Text+Text and Bytes+Bytes concatenate into fresh immutable storage. Other
arithmetic combinations fail explicitly. Numeric int/bool comparisons operate on
their exact values. Text orders lexicographically by Unicode scalar value
(implemented by valid UTF-8 byte ordering); bytes order by unsigned byte.
Different nonnumeric kinds compare unequal. None equals None, but neither None
nor unrelated kinds support ordering. No normalization changes text data.
`CompareChain(Box<Expression>, Vec<(Comparison, Expression)>)` evaluates its first
operand once, then each comparator operand once in source order, retaining each
right operand as the next left operand. It returns Boolean false immediately
when a comparison fails and does not evaluate later operands; otherwise it
returns Boolean true. A reached invalid ordering still fails with type 105.

`Len` accepts text and bytes only. Text length counts Unicode scalar values,
including embedded NUL and combining characters separately; bytes length counts
every byte. It returns an exact hosted integer. Valid UTF-8 construction permits
a native leading-byte count without text normalization or an external Unicode
runtime. The 64 MiB sequence bound keeps counts below base 1e9; an explicit
conversion guard prevents truncation if that resource policy changes. Nonzero
length results allocate one checked integer object and descriptor, and zero
length results share the immutable integer zero through a new descriptor.

`FloorDivide(Box<Expression>, Box<Expression>)` and `Modulo` accept Int/Bool
operands and return Int, using the same private native div/rem kernel. They do
not extend the legacy fixed-i64/hosted IR or the shared `Binary` enum. For a
nonzero divisor, the exact results satisfy `a = q*b + r`, `abs(r) < abs(b)`, and
the remainder has the divisor's sign unless zero. Different operand signs with
a nonzero magnitude remainder adjust the quotient away from zero and complement
the remainder. Operands remain immutable, including identical operand aliases.
Both operand expressions evaluate left-to-right before the operation's type
guard; a skipped short-circuit branch does not perform division at all.

The kernel traverses numerator limbs from high to low. A one-limb divisor uses
hardware unsigned DIV on each exact two-limb intermediate. The general path
binary-searches each base-1e9 quotient digit in at most 30 trials, reusing one
divisor-product buffer and doing one final product before subtraction. Leading
zero quotient digits avoid candidate products. It never subtracts once per unit
of quotient. Scratch consists of quotient capacity `N+1` limbs and remainder
and product capacities `M+1` limbs, each with a 16-byte object header and 8-byte
allocation alignment; the single-limb path omits the product buffer. Scratch
and output descriptors share the existing arena and are not reclaimed.

For a nonzero numerator and a divisor of at least two limbs, the temporary
per-operation work limit is `N*M <= 1000000`, where N/M are normalized magnitude
limb counts. The guard checks `N <= floor(1000000/M)` without overflowing a count
product, before scratch allocation or traversal. The single-limb path remains
linear and arena-bounded; zero numerators return exact zero immediately after
the nonzero divisor check. Explicit count bounds keep scratch-size arithmetic
within range. This limit is not fixed-width integer arithmetic or truncation.
Exceeding it reports `NJA203: native division work limit exceeded` / exit 103,
distinct from arena exhaustion. A zero divisor reports
`NJA206: integer division by zero` / exit 106 with best-effort stderr output.
Unsupported operand kinds still report type failure 105. These process failures
do not implement catchable language exceptions.

Truthiness is false for zero integers, False, empty text/bytes and None. `not`
returns a Boolean. `and`/`or` return an original operand descriptor and evaluate
their right operand only when required. Printing text writes the raw UTF-8 bytes
and a newline, including embedded NUL; Booleans print True/False and None prints
None. Bytes use `b` plus quoted ASCII representation: double quotes only when an
apostrophe exists and no double quote exists; escape the selected quote,
backslash, tab/newline/carriage return, and use lowercase hex for other bytes
outside printable ASCII. This behavior was checked by reading the pinned
[Python 3.15.0 primary source](https://raw.githubusercontent.com/python/cpython/d220409a13b77de7a6c30abe16ea90db01528edc/Objects/bytesobject.c),
`_Py_bytes_repr` (lines 1354–1426). No Python runtime or oracle was executed.
The native formatter and independent Node specification vectors cover all 256
byte values and the quote-selection cases.

The private descriptor is three 64-bit fields: tag, payload pointer, byte length.
Tags are int=0, text=1, bytes=2, bool=3, None=4. Bool points to an immutable integer
zero/one object; other numeric payloads remain arbitrary precision. Literal
descriptors/data reside in the ELF read/execute segment; result descriptors,
concatenated data, integer objects and formatting buffers share one 64 MiB RW
anonymous arena. Allocation is aligned, checked before construction/copying, and
never reclaimed. Byte formatting reserves its bounded worst-case output size.
Lengths/tags are checked before interpreting sequence payloads. IR cannot inject
pointers or arbitrary descriptor tags, and this private layout is not an FFI or
a defense against arbitrary external memory corruption. Tests mutate tags and
lengths to verify the implemented guards explicitly.

Arena exhaustion reports `NJA203: native value arena exhausted` and exits
103; failed assertions report NJA204 and exit 104; unsupported operand types or
ordering report `NJA205: native value type mismatch` and exit 105. These are
process failures, not catchable exceptions or an unwinding implementation.
Output failures report NJA202/exit 102; diagnostic stderr writes are best effort.
The default OS SIGPIPE policy remains unchanged. The arena is not managed memory
or a sandbox. Execution uses ordinary Linux process rights and an external
five-second timeout in the test harness.

`cargo test --workspace --locked --offline` checks IR limits and ELF structure.
`node scripts/test-dynamic.mjs` builds the development-only `dynamic_ir` example,
then executes emitted artifacts on Linux x86-64 or an explicitly declared local
WSL Linux x86-64 target on Windows. The adapter's line/RPN format is not NAJA
syntax: `t:HEX_UTF8`, `b:HEX`, decimal integers, true/false/none, `%SLOT` and
postfix operators; statements are print/assert/set/if/while/group with else/end.
Unary postfix operators include `pos`, `len` and `require_int`. A postfix
`chain:<,<=,==` consumes four existing expression operands in order and creates
one three-comparison chain. The fixture format does not change source grammar.
Postfix `//` and `%` construct the separate dynamic division/modulo variants.
It is bounded and refuses existing output files. Node BigInt, Unicode codepoint
and byte oracles check arithmetic, comparisons, truthiness and repr, together
with metamorphic properties, native resource/type/assert/output failures,
short-circuiting, immutable aliases, malformed IR and descriptor/data mutants.
Chain tests also reserve about 32 MiB, then evaluate an allocating 16 MiB middle
operand once: the proper chain passes while an explicit repeated-middle control
exhausts the same 64 MiB arena. Separate probes skip resource/type failures,
preserve the first failure's evaluation order and exercise maximum chain width.
Division checks use Node BigInt with an explicit floor adjustment, signed range
and reconstruction identities, all signs and Bool inputs, carry/borrow cases,
20,000-digit single-limb and 5,000/2,000-digit general division, immutable aliases,
runtime-computed zero divisors, evaluation order, arena/work failures and literal
and signed-adjustment mutants. A 1000-by-1000-limb general case exercises the
exact work boundary, and 1001-by-1000 is rejected with the work-limit diagnostic.
Fixtures and unsigned ELF hashes are retained under ignored `target/`.

Floats, repetition, list/dict/set/tuple, functions, classes, user methods,
identity/hashing, mutable objects, conversions, exception handling and managed
memory remain required future work. The `.naja` edition's numeric string-literal
multiplication rule belongs to frontend semantic resolution and is not inferred
from arbitrary runtime text here. No Windows/macOS native target, self-hosting,
clean-host, performance or release-distribution claim follows from these tests.
