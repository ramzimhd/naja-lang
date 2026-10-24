# 07 — Memory, Hardware and Domain Libraries

## Hardware objects represent three different things

**Discovery:** visible logical CPUs, capabilities and target information. `CPUs.count()` reports logical processors available to the process under documented restrictions; it is not a universal physical-socket count.

**Authorized execution:** operations allowed in the current context, such as a driver call, allocation or permitted peripheral access.

**Code generation:** symbolic registers/instructions owned by a compilation block, not persistent physical-register objects on an arbitrary core.

```naja
from naja.hardware import CPUs
print(CPUs.count())
cpu = CPUs[0]
print(cpu.architecture)
```

This proposed API grants neither affinity nor privileged register access.

```naja
from naja.machine import Assembly

with Assembly.for_target("x86_64") as asm:(0)
    rax = asm.registers.rax
    rax.move(1)
    rax.add(2)
    asm.return_(rax)
```

The block describes a machine function. Calls/ABI follow its builder contract; the block is not automatically executing physical instructions. Check reserved registers, clobbers, sizes, ISA availability and calling conventions. Use `1` or `0x01`, not invented leading-zero decimal syntax.

Distinguish optimizable expressions from exact instruction blocks. Preserve promised exact properties, or optimize while preserving effects, respectively. Validate results and disassembly.

## Memory and concurrency

Safe native buffers/values retain bounds and lifetime protection. FFI documents ownership, alignment, layout and borrowed lifetimes. Raw pointers require an explicit unsafe scope. Core supports controlled allocators; hosted supports automatic memory.

Threads, tasks and future actors share resource/cancellation contracts. HATCH includes the bounded mechanisms required by its tools and networking. GIL-free or data-race-free claims require specific evidence and are not implied by a Rust seed.

## HATCH extension proofs

**Systems/embedded:** a documented freestanding QEMU demonstration with serial output and controlled hardware access. Publish ISA, machine and actual boot support. Revision 1.2 adds a bounded productivity microkernel task with explicit behavior; neither demonstration is a complete OS or universal board support.

**Numerical computing:** an additional native CPU buffer/array library written in NAJA, with an executed calculation and no parser changes. This proves extensibility, not a PyTorch replacement.

**Quantum:** a small bounded local circuit simulator implemented as an optional NAJA library. No cloud account or real-QPU claim. QIR export may follow later; its LLVM relationship does not make LLVM compulsory. [S15]

**Web:** a genuinely tested local HTTP server. Full browser WebAssembly, DOM and WebGPU are later capabilities, not implied by an HTTP example.

**Data pipelines, added in 1.2:** native CSV and JSONL ingestion, explicit schema/validation, streaming transformations, bounded grouping/aggregation where requested, deterministic output, cancellation and error policies. These are mandatory bounded HATCH workflows under documents 21–22; a distributed data platform is not required.

## Future directions preserved

Dataflow, incremental/reactive computing, effects, actors, probability, differentiation, constraints/logic, distribution, agents and adaptive optimization first use APIs and IR properties. New syntax is not the default answer.

AI/GPU APIs expose buffer/dtype/shape/device/transfer contracts. Optional MLIR/LLVM adapters do not imply Python, PyTorch, PyQIR or a vendor requirement. Driver integration still needs real implementation. [S14]

Quantum handles represent resources with controlled operations/lifetimes, not clonable unknown quantum state. Declare gate sets, connectivity, shots, simulator limits and real-service costs. This mission does not authorize paid QPU calls.

IoT HAL, MMIO, volatile/atomic access and interrupts are target interfaces. Hard real-time claims require bounds and measurement, not simply absence of GC. Hosted networking cannot silently become a microcontroller requirement.

## Interactive resource lifetimes

Do not free or reinterpret old function/class versions while values, tasks or callbacks still reference them. Session limits and resets are explicit. File/network/hardware effects are not generally undoable and must not be replayed automatically. Interactivity is a hosted developer service, not mandatory executable-memory or GC machinery for kernels or constrained devices.

## High-level simplicity with explicit escape hatches

Reusable system/data/application facades must expose configuration, limits, errors and lower-level primitives. Their concise default path is not permission to remove safe operation, obscure allocation or ignore target restrictions. The exact productivity evidence is defined in document 22.
