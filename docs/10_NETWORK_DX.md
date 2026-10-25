# 10 — Native Networking and Two-Line Applications

## Intent

Create common servers quickly, with explicit receive/error callbacks when needed. `Network.App.Server.TCP(80) { ... }` expressed the original API intent. Use ordinary functions, decorators and the general suite forms authorized by [ADR-003](decisions/0003-language-edition-2026-1.md); networking introduces no separate grammar.

“Native” means a NAJA standard library independent of Python, compiled natively and using declared platform services. It does not mean a networking keyword or rewriting the host TCP stack.

## API contracts — not implemented by this package

### TCP echo, two lines including import

```naja
from naja import Network
Network.App.Server.TCP(8080).run(on_receive=lambda msg: msg.data)
```

Defaults: loopback, byte-stream events, documented bounds and clean shutdown. `ReceiveEvent.data` is the received chunk; returning bytes requests sending them on the same connection. One send is not guaranteed to produce one receive. [S12]

### HTTP response, two lines

```naja
from naja import Network
Network.App.Server.HTTP(8080).run(on_request=lambda req: "Hello NAJA")
```

A string produces a documented UTF-8 text response/status/headers. `Response` exposes full control. Routing, static content, security and realistic application behavior require additional APIs; two lines are not claimed to implement every website.

### Explicit handlers

```naja
from naja import Network

server = Network.App.Server.TCP(8080)

@server.on_receive
def receive(msg):(0)
    print(msg.peer)
    return msg.data

@server.on_error
def failure(error):(0)
    print(error.message)

server.run()
```

Callback names are APIs, not keywords. Alternative spellings require documented API aliases, not hidden grammar.

## Server lifecycle

Construction does not listen. `run()` starts explicitly and blocks until shutdown. A corresponding async `serve()` composes with NAJA's existing event loop rather than secretly creating another. Test create/configure/serve/stop/close.

`on_receive` handles stream chunks. `on_message` requires an explicit framing codec, such as bounded lines or capped length prefixes. Test fragmented/coalesced data. Define per-connection callback order and cross-connection concurrency.

Basic TCP callbacks return bytes or `None`; HTTP returns declared response types. Callback exceptions follow a clear error/close policy without recursive error-handler loops. Bind/listen errors propagate to the caller rather than being swallowed.

## Robust defaults

Listen on configured loopback, not `0.0.0.0`, unless explicitly requested. Port 80 remains possible subject to OS privileges; examples use 8080 and tests ephemeral ports. Never open a firewall automatically.

Bound connections, buffers, read/write/idle deadlines, backpressure, cancellation and shutdown time. Handle partial writes, disconnects, half-close, slow clients and bounded tasks. TLS uses reviewed implementations/platform services with declared dependencies, never home-grown cryptography or Python. Do not claim production exposure readiness before appropriate audits.

## HTTP HATCH profile

Implement a bounded documented HTTP/1.1 subset: strict parsing, maximum sizes, unambiguous Content-Length/Transfer-Encoding, malformed-input rejection and correct connection closing. Unsupported modes fail cleanly rather than being guessed. Test real requests/responses on each announced OS.

HTTP/2, HTTP/3, WebSockets, MQTT, full UI and complete application frameworks remain later unless explicitly added to scope.

## Acceptance

Test binary and UTF-8-encoded payloads, fragmentation/coalescence, multiple/slow clients, limits, peer closure, bind errors, raised handlers, cancellation and orphan-free shutdown. Framed messages must reconstruct correctly and reject oversized lengths. HTTP tests include success, controlled errors, malformed input and limits.

Measure latency, memory and cleanup. Never compare a minimal loopback demo with a production server in another language and claim universal superiority.

## Interactive servers

Opening a listener is an external effect. A blocking server occupies the session until stopped. Run Cell must not replay old socket creation or silently duplicate listeners. Expose active tasks/resources and explicit stop/reset; no rollback claim for bytes already sent. Test on loopback only.

## Broader productivity target

Two-line demonstrations are usability contracts, not evidence of a 4:1 advantage over idiomatic Rust/C++ frameworks. Document 22 adds matched server behaviors, failure paths, shutdown and complete developer-owned source accounting. Keep both simple defaults and explicit low-level controls. Extend the same design philosophy to bounded microkernel and data-pipeline libraries in document 21.
