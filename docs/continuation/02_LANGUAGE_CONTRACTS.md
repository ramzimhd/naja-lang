Consolidated Language Contracts — Controlled Flexibility
Status: Founder intent consolidated into implementation defaults. The examples below are design/test contracts, not claims that the current seed accepts them. Record final grammar and API details in ADRs before implementation. A spelling change that preserves intent is an engineering choice; removing a capability is not.
L01 — Language identity, modes and policy
NAJA is a new language with familiar Python-like source forms, not a Python interpreter or a promise of interchangeable runtime behavior. .naja is its primary evolving dialect. Keep the existing .py compatibility surface explicitly versioned and tested, with no hidden reinterpretation and no Python execution dependency. Parsing support is not semantic or package compatibility.

Use a language edition and capability manifest. Style policies may require braces or depth annotations; they cannot make an accepted addition mean concatenation in another project without a visible edition/type distinction. Compiler, formatter, LSP, debugger and cell engine use the same syntax/resolution model. Alias tables, imports, policies, edition and public interface versions belong in cache keys.

Hosted, core and embedded capabilities differ. A profile does not change arithmetic silently, confer OS privileges, or make GC/allocation/IO universally available. The language specification stays separate from backend, seed language and private object layout.
L02 — Explicit, indented and named blocks
Support familiar indentation and optional depth labels, plus the founder's brace-delimited style:
if age >= 18: {# Calculate salary #
salary = 100
bonus = 20
print(salary + bonus)
}
Indentation inside a braced suite is stylistic, not the delimiter. Keep : before a control-suite { for this edition; no need to add both colon and colonless forms immediately. Put the suite opening at the end of its header and start statements on the next line. Define else/elif/except/finally association unambiguously, whether the previous } is on the same or preceding line.

A standalone named section is also allowed:
{# Calculate salary #
salary = 100
bonus = 20
total = salary + bonus
}
print(total)
This section is transparent grouping: it does not create a variable scope, change evaluation order, add a cleanup boundary, or introduce hidden runtime behavior. Ordinary functions/classes keep their declared scopes; brace notation must not alter the scope that the corresponding indented suite would have. A named section is not an automatic cell, transaction or asynchronous task.

{# Label # is special only where a named suite/section can begin. The closing # terminates the single-line label, followed by optional whitespace and newline. Reject missing terminators, ambiguous nested labels or unexpected trailing code. Ordinary # comments and # inside strings retain their meaning. Names are editor/debug metadata, not identifiers; duplicate display labels need not be global symbols.

Preserve dictionary/set expressions such as data = {"name": "NAJA"}. Bare { at statement start is not a general anonymous section in the first edition; require {# Label # for a standalone section to avoid empty-map/set ambiguity. In .naja, a control header ending with : { plus a newline selects a suite; valid .py one-line dictionary-expression suites remain in the compatibility grammar.

A suite chooses one delimiter system. Support mixed styles at explicit suite boundaries with a documented stack-based rule: a nested indented suite uses its own header indentation as its baseline, a brace closes only its matching brace suite, and a pending indentation suite must close at a valid boundary. Reject ambiguous mixtures; never guess from formatting. Include examples for every supported combination. Do not globally discard NEWLINE/INDENT information just because a brace exists; expression braces and suite braces have different roles.

Depth markers keep their earlier meaning:
def calculate():(0)
    if enabled:(1)
        print(1)
x is nesting depth, not a sequential global identifier. Siblings have equal depth. In the first implementation, use depth markers with indentation suites and labels with brace suites; diagnose unsupported combined decorations instead of guessing. The formatter may convert verified equivalent forms, respecting strings/comments/expressions and source maps. Neither named blocks nor optional markers have execution costs beyond optional debug metadata.
L03 — Project aliases
naja.alias remains optional. Conventional spellings still work. Resolve aliases contextually in tokens/AST, preserve precedence, associativity, comparison chains and short-circuit rules, and retain original source locations. Do not rewrite strings, regexes, comments, member names or unrelated identifiers.
[operators]
"==" = "equalTo"
"!=" = "notEqualTo"
"<" = "lessThan"
"<=" = "lessThanOrEqualTo"
">" = "greaterThan"
">=" = "greaterThanOrEqualTo"

[builtins]
"print" = "display"
Disallow conflicts with reserved grammar/operator positions and diagnose ambiguous names. Aliases apply to the owning project/module, never retroactively to dependency sources. Unicode aliases are allowed under the same identifier/security policy. Optional glyph aliases such as × and ÷ are token mappings to * and /, not a second arithmetic model.
L04 — Uniform object capabilities and representations
All values can expose methods/properties, but not every value must be boxed, heap allocated or dynamically dispatched. Define value/reference semantics, mutability, identity, equality, hashing, lifetimes and field layout contracts. Fixed-size numeric structs should be representable inline when legal.

Provide generics, protocols/capabilities, type inference and flow-sensitive narrowing. Prefer protocols over mandatory deep inheritance. Add user-defined operators through a reusable algebra protocol; explicit traditional methods remain an escape hatch for genuinely different operations. Do not infer algebraic laws from method names.

Hosted int must not silently become i64. Keep explicit checked machine integers and named wrapping/saturating operations. A flexible native NAJA object representation is allowed when static specialization is insufficient; an external interpreter is not.
L05 — Controlled class extensions
Support methods and computed properties on existing types without inheritance or layout mutation:
from naja import extend

@extend(String)
def WordCount(self):
    return len(self.Split())
An extension becomes available through explicit scoped imports, not global monkey-patching or dependency load order. Actual members, including inherited members, win; ambiguous equally applicable extensions are errors. Provide a qualified function-call escape hatch. No new stored fields, automatic private-member access, hidden static initialization or retroactive override.

Define coherence rules for protocol/operator/conversion implementations. Ordinary scoped extension functions can enrich an external type, but globally coherent implementations cannot be installed arbitrarily for two foreign identities. Prefer an owner-defined implementation or an explicit scoped adapter/wrapper when neither side is owned. Publish the selected candidate and reason through diagnostics/Lens.
L06 — Partial classes with authorized folders
A single fully qualified class has one primary definition and an explicitly enumerated parts directory:
src/models/Person/main.naja
src/models/Person/parts/validation.naja
src/models/Person/parts/events.naja
[partial_classes."models.Person"]
root = "src/models/Person/main.naja"
directory = "src/models/Person/parts"
files = ["validation.naja", "events.naja"]
from naja import partial

@partial
class Person:
    def IsAdult(self):
        return self.age >= 18
The primary definition owns stored fields, base types, type parameters, construction and ABI/layout. Parts may add allowed methods/computed properties/behaviors; reject conflicting constructors, fields or signatures. New stored event state belongs in the root definition. Do not merge unrelated classes just because they share the short name.

Only same-package authorized files participate. No ambient recursive discovery, cross-package fragments, external type reopening or source-order dependent layout. Check canonical paths, symlinks, path traversal, case-folding collisions and build reproducibility. Manifest policy is a compiler check, not an OS security sandbox. Generated parts must be declared and reproducible, with provenance and no arbitrary install-time execution.
L07 — Typed numeric literals
Support numerical literals followed by eligible developer-defined type names:
print(10Gramme + 20Kilo)
The resolved literal-construction protocol creates a typed value, conceptually Gramme(10), not multiplication by a variable and not a hard-coded unit table. Numeric-literal participation is explicit through the class/algebra protocol; a class with unrelated constructors is not automatically eligible.

Define lexical precedence for decimal/exponent/base literals, underscores, signs, reserved numeric suffixes and identifiers. Prefer rejecting an ambiguous spelling with a constructor suggestion over guessing. 1e3, numeric base prefixes and any supported complex suffixes must not be broken. Construction from exact decimal literal text must avoid an unnecessary binary-float round trip when the target is Decimal/Rational. Constructor semantics and side effects cannot be erased unless proven safe.

Suffixes require an in-scope type. Unknown/ambiguous names are diagnostics. Conventional constructors always remain available, including for qualified/imported names. Keep literal syntax separate from variable construction; amountGramme remains an identifier, not a value-dependent suffix operation.
L08 — Relations declared once, operations derived correctly
Use a reusable algebra and a declared relation, not one handler for every operator/type pair:
from naja import Quantity

class Gramme(Quantity):
    pass

class Kilo(Quantity, relative_to=Gramme, scale=1000):
    pass

print(10Gramme + 20Kilo)   # 20010 Gramme
print(20Kilo + 10Gramme)   # 20.01 Kilo
print(2Kilo / 500Gramme)   # dimensionless 4
Separate algebra (valid operations), relation (conversion) and promotion (result). Left-hand representation for addition/subtraction is the default for this quantity family, not a universal rule for all classes. Promote the scalar storage when necessary rather than truncating 20.01 to 20; representation unit and numeric storage type are distinct. Cross-unit equal values require compatible hashing if hashable.

Relations identify a common abstract family/dimension. Compose exact scale factors, reject contradictory cycles/ambiguous paths, and never convert incompatible dimensions. Scalar multiplication, quantity multiplication and quantity division have different result rules. A single scale relationship does not justify every possible operator.

An inheritance spelling may be supported as sugar when substitutability is valid, but mathematical conversion must not automatically imply object inheritance. Libraries can define other algebras once and reuse them; unknown nonlinear functions are not automatically inverted or treated as ring homomorphisms. Do not trust asserted associativity for floating-point reassociation.

For affine scales, declare the relation kind explicitly:
class Fahrenheit(
    Quantity,
    relative_to=Celsius,
    relation="affine",
    points=((32, 0), (212, 100))
):
    pass
The tuples map Fahrenheit coordinates to Celsius coordinates. Two points determine an affine map only under that declared assumption; distinct source coordinates and appropriate invertibility are required. Derive forward/inverse conversion with exact rational coefficients where possible. Distinguish points from differences: point minus point yields a delta, point plus delta yields a point, and ordinary point plus point is rejected by default. A Fahrenheit delta conversion applies scale, not offset. Bounds and validity constraints are checked after conversion.
L09 — Constrained and pattern-derived values
Support concise and reusable forms, with one underlying semantic mechanism:
age: (1 to 40) = 25
weight: (20.0 to 30.0) = 24.5

type Age = (1 to 40)
Bounds are inclusive by default and require a declared base numeric policy. Integer endpoints infer an integer interval; decimal-looking endpoints must follow the documented decimal/float inference rule, not a hidden platform-dependent choice. Conventional typed constructors/annotations remain available for explicit Decimal/Float distinctions.

Validate proven constants at compilation; otherwise validate at construction, assignment, mutation and API boundaries. Never remove necessary checks in release mode. FFI/deserialization must establish invariants. Arithmetic does not automatically retain a refinement: Age(40) + 1 is not a valid Age without a checked conversion. Define behavior for NaN, infinity, overflow, empty intervals and immutable/shared refined fields.

Custom pattern-derived objects expose captures:
email: (matches r"([^\s@]+)@([^\s@]+)") => (
    User: 1,
    Domain: 2
) = "reader@example.com"
This is a syntax demonstration for a restricted pattern, not the built-in Email standard. Require a full match. Capture zero is the whole match; numbered captures start at one. Prefer named captures for stable public properties. Reusable/classic form:
type ContactText = Pattern(
    r"(?P<User>[^\s@]+)@(?P<Domain>[^\s@]+)",
    fields={"User": String, "Domain": String}
)
Types can be explicit or conservatively inferred: text by default, optional text for unmatched optional groups, numeric only through declared checked parsing or a proven rule with a defined numeric representation. Do not infer all possible meaning from arbitrary regex syntax. Reject duplicate/reserved property names and define repeated-capture behavior.

Anonymous structural types have local stable identities/shapes; exported APIs need named/versioned schemas. Captures are immutable fields or lifetime-safe views tied to immutable backing storage. Updating the underlying text must create/revalidate a new value. Set pattern length/input/work budgets; unsupported expensive constructs are diagnosed, not executed with unbounded backtracking. Do not use regex validity as proof of external truth.
L10 — Built-in validated structured types
Provide native Email, IPAddress/IPv4/IPv6 and an extensible catalog for URL, UUID and related values. Expose useful properties, for example .User, .Domain, .Version, .ToString(), without requiring the user to declare a pattern.

Built-ins use domain-appropriate parsers and documented validation profiles. An email parser must distinguish syntactic acceptance from mailbox existence; no implicit DNS/network traffic. Preserve local-part meaning and document domain/Unicode normalization. IP values use structured address representations and explicit handling of network prefixes, zone identifiers and canonical display as applicable. Do not pretend IP membership implies authorization, trust or reachability.

Do not add field extraction by ad hoc string splitting to a language advertised as validated. Publish supported edge cases and native tests, including invalid input and serialization round trips.
L11 — Conversions and concise collections
Expose ToString, ToInt, ToFloat, ToDecimal, To(Type) and failure-aware TryTo.../Result-style counterparts through protocols. Use invariant explicit formats by default; locale-dependent parsing requires explicit options. No universal automatic chaining of conversion methods until one happens to work.

Honor the founder's numeric constant example in .naja:
print(5 * "5")          # 25
print("5" * 5)          # 25 under the same numeric literal rule
print("5" + "5")        # "55": native string concatenation
print("5".Repeat(5))    # explicit repetition
Resolve direct native operations first. The numeric multiplication fallback may parse a compile-time string constant losslessly under a fixed documented numeric grammar. Define decimal/floating promotion for 5 * "5.5" before implementation. Invalid constant text is a diagnostic. Unknown runtime text requires an explicit checked conversion or an explicitly enabled checked API, not behavior that changes between repetition and multiplication according to the input text. Equality/hash and overload lookup must remain coherent.

ToInt() is checked; fractional rounding/truncation must follow a named documented policy, not an unmentioned loss. print uses the display/String protocol after computing the result; user side effects in conversion are respected. Constant folding is an optimization of this general rule, not hard-coding the examples.

Support concise reductions and methods:
print(sum(1, 2, 4778, 6))       # 4787
print([1, 2, 3, 4].sum())       # 10
print([1, 2, 3, 4].mean())      # 2.5
Specify overloads without Python's positional-start ambiguity: in .naja, variadic scalar sum is one form and collection sum accepts an optional named start. Define empty inputs, mixed types, overflow, precision and heterogeneous-list failures. .py behavior remains separately pinned. Choose a coherent canonical API casing and stable aliases rather than duplicating every method arbitrarily; retain the requested public conversion spelling.
L12 — Numerical/data foundations and functional optimization
Provide coherent native Array, mathematical Vector, Matrix, Tensor and DataFrame foundations. A mathematical Vector is not automatically a hardware SIMD register. Specify dtype, shape, rank, layout/strides, ownership, views/copies, mutation, broadcasting and device location. Static incompatibilities fail early; dynamic shapes keep checks. Define * elementwise versus @ contraction/matrix product and tensor reduction axes.

Implement real bounded math/statistics/geometry: reductions, norms, dot/matmul, selected decompositions or solves, points/distances/transforms and pipeline aggregations. State numerical precision, variance convention, degeneracy/singular behavior, overflow, NaN/missing-value rules and memory limits. Advanced catalogs extend these protocols; the compiler is not a monolithic collection of every scientific algorithm.

Data operations use declared schemas/error policies and bounded processing. Read/write practical formats progressively; distinguish dataframe semantics and missingness from untyped lists. An optional native Arrow-compatible interface or NPY/CSV/JSONL/Parquet adapter is data interoperability, not permission to require Python or claim arbitrary pandas-object compatibility. Zero-copy requires compatible layout, process boundaries and lifetimes.

Functional map/filter/reduce pipelines may fuse, specialize, avoid temporaries, vectorize or parallelize only when their semantic/alias/effect contracts allow it. Floating-point reductions are not freely associative; preserve strict evaluation/numerical policy by default and make approximate/reordered modes explicit. Do not move code to a GPU or remote machine silently. Evaluate profitability and publish measurements rather than promising universal optimality.
L13 — Native execution and typed events
Implement synchronous calls, async/await, native threads, bounded thread pools, structured task groups, native parallel map/reductions, channels, locks/atomics and cancellation. No global interpreter lock that serializes all ordinary independent native CPU work. Locks and synchronization remain necessary for shared state; memory safety is not proven merely by writing the seed in Rust.

Separate async waiting from CPU parallel execution. Specify task scheduling, parent/child lifetime, join semantics, exceptions, cancellation/cleanup, queue limits, ordering, backpressure and deadlock/error handling. Detached tasks require an explicit managed owner. Use target-specific native IO adapters; no .NET or Python dependency.

Support typed custom, file, network, application-input and system events under one lifecycle model. Subscriptions have explicit disposal; instance events must not accidentally share subscribers because a mutable declaration object was reused across instances. UI callbacks respect thread affinity. Async handlers have defined ordering and bounded outstanding work. Errors are observable, not silently discarded.

Keyboard/mouse handlers default to events belonging to the application's own focused window. Global hooks, cross-application monitoring, raw devices and privileged system events require explicit capabilities and OS consent. Some events are platform-specific or best-effort. Bare-metal interrupt handlers need a separate bounded interrupt-safe subset and deferred-work interface, not an ordinary heap-allocating GUI callback.
L14 — Concise applications, hardware and domains
Retain genuine two-line TCP/HTTP examples, including import, with safe local defaults:
from naja import Network
Network.App.Server.TCP(8080).run(on_receive=lambda msg: msg.data)
A TCP receive is a byte chunk, not a guaranteed whole message. Framing, partial writes, cleanup, bounded buffers and cancellation are real functionality. General function/decorator/event syntax provides richer handlers; general braces may format their bodies without a special networking parser.

Hardware objects distinguish observation, authorized control and compile-time instruction construction. CPUs[0] is not an owned persistent register bank. Register operations require target/ABI/permission contracts. Preserve portable high-level code, explicit intrinsics, FFI safety, OS/core/embedded separation and real freestanding tests.

ML, AI agents, robotics, web/native applications and quantum computing share the extensible foundations, not a universal execution promise. AI APIs distinguish model loading/inference, training, tools, policy and external service calls. No hidden credentials/cloud spending, canned model outputs or unapproved QPU/network use. Quantum operations have their own resource and measurement contracts.
L15 — Compiler insight, contracts and controlled metaprogramming
Preserve the candidate differentiators without making impossible blanket claims:
- Lens: expose real resolved types, conversions, native assembly, allocations where known, transformations and refusal reasons. Never show an invented measurement.
- Intent: speed/size/memory/energy goals select legal strategies. Unknown power/latency without target measurement stays unknown; requirements do not imply mathematical global optimality.
- Contracts/Smart Types: distinguish compile-time proof, runtime validation and user assertions. Optimizations cannot assume an unverified annotation is true.
- Transform: vectorization, batching, differentiation and future incremental execution operate only on supported effect/shape subsets with explicit failure diagnostics.
- Compile time/derive: bounded deterministic evaluation and hygienic typed generation, with visible expansion/source maps. Inputs and capabilities are declared; no silent network, arbitrary filesystem writes or secret/environment reads. Do not claim that any arbitrary host process is sandboxed merely because a manifest says network=false.
- Actors/supervision: preserve as an extension path over structured lifetime, messaging and error contracts; do not impose a distributed runtime on ordinary programs.
Maintain one small coherent set of types, effects, shapes, relations and capabilities rather than fifteen unrelated mini-languages.
