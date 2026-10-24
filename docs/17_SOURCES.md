# 17 — Primary References and Verification Boundaries

These reference IDs/URLs are carried forward from package 1.1 and translated into English. This 1.2 documentation update does not claim to have freshly revalidated every page or release. Before implementation, the agent must verify relevant official sources, pin editions/versions and record the actual access date. The NAJA architecture and gates are project decisions, not features delivered by these references.

## [S01] Python 3.15 — Compound statements

https://docs.python.org/3.15/reference/compound_stmts.html

Compound suites, indentation and same-line forms; a language reference, not a runtime dependency.

## [S02] Python 3.15 — Expressions

https://docs.python.org/3.15/reference/expressions.html

Comparison semantics, precedence and evaluation order relevant to aliases.

## [S03] Python 3.15 — Data model

https://docs.python.org/3.15/reference/datamodel.html

Object behavior and the distinction between language rules and CPython details.

## [S04] Rust Compiler Development Guide — What bootstrapping does

https://rustc-dev-guide.rust-lang.org/building/bootstrapping/what-bootstrapping-does.html

Staged compiler construction; not proof of NAJA independence.

## [S05] LLVM — Getting Started

https://llvm.org/docs/GettingStarted.html

Infrastructure dependencies and upstream LLVM building.

## [S06] LLVM — Getting Started with Visual Studio

https://llvm.org/docs/GettingStartedVS.html

Windows LLVM building and test dependencies; audit indirect Python requirements.

## [S07] VS Code — Language Server Extension Guide

https://code.visualstudio.com/api/language-extensions/language-server-extension-guide

Separation of language-server and editor-client responsibilities.

## [S08] VS Code — API reference

https://code.visualstudio.com/api/references/vscode-api

Host API for editor extensions and functionality.

## [S09] VS Code — Publishing Extensions

https://code.visualstudio.com/api/working-with-extensions/publishing-extension

VSIX packaging/distribution and publisher requirements.

## [S10] VS Code — Debugger Extension

https://code.visualstudio.com/api/extension-guides/debugger-extension

Native debugger integration and its protocol separate from LSP.

## [S11] VS Code — Workspace Trust Extension Guide

https://code.visualstudio.com/api/extension-guides/workspace-trust

Untrusted workspace execution controls.

## [S12] IETF — RFC 9293, Transmission Control Protocol

https://www.rfc-editor.org/rfc/rfc9293.html

TCP byte-stream transport semantics.

## [S13] The Embedded Rust Book — no_std

https://docs.rust-embedded.org/book/intro/no-std.html

Core/freestanding versus hosted library separation.

## [S14] MLIR — Documentation

https://mlir.llvm.org/docs/

Extensible intermediate representations and transformations; optional integration.

## [S15] QIR Alliance — What is QIR?

https://www.qir-alliance.org/qir-book/concepts/what-is-qir.html

QIR/LLVM relationship; not grounds for a Python dependency.

## [S16] GitHub CLI — gh repo create

https://cli.github.com/manual/gh_repo_create

Authorized public repository creation with a verified owner.

## [S17] GitHub Actions — Secure use reference

https://docs.github.com/en/actions/reference/security/secure-use

Workflow security, action dependencies and secret handling.

## [S18] SPDX — Apache License 2.0

https://spdx.org/licenses/Apache-2.0.html

The proposed license identifier and text; no legal opinion is provided here.

## [S19] Rust Compiler Development Guide — How to build and run

https://rustc-dev-guide.rust-lang.org/building/how-to-build-and-run.html

Upstream rustc bootstrap; using a prebuilt seed is not rebuilding rustc.

## [S20] Python — Release 3.15.0

https://www.python.org/downloads/release/python-3150/

Inherited candidate grammar release reference; verify availability and pin before implementation.

## [S21] OpenAI — Custom instructions with AGENTS.md

https://developers.openai.com/codex/agent-configuration/agents-md

Project instructions for Codex; verify the current official mechanism before use.

## [S22] Anthropic — How Claude remembers your project

https://code.claude.com/docs/en/memory

Project instructions for Claude; compliance still needs verification.

## [S23] VS Code — Extension Marketplace / Install from a VSIX

https://code.visualstudio.com/docs/configure/extensions/extension-marketplace

Installing a packaged extension manually or from the command line.

## [S24] VS Code — Supporting Remote Development

https://code.visualstudio.com/api/advanced-topics/remote-extensions

UI host versus remote workspace execution environment.

## [S25] Clang — Clang-Repl

https://clang.llvm.org/docs/ClangRepl.html

Incremental C++ compilation and native execution as a feasibility precedent.

## [S26] LLVM — ORC Design and Implementation

https://llvm.org/docs/ORCv2.html

Native runtime linking, symbols, sessions and resource ownership; ORC stays optional.

## [S27] VS Code — Notebook API

https://code.visualstudio.com/api/extension-guides/notebook

Cell controllers and display; not a requirement for a Python kernel.

## [S28] Julia — Performance Tips

https://docs.julialang.org/en/v1/manual/performance-tips/

Separating compilation/startup from execution timings; no NAJA performance guarantee.

## [S29] Python — Glossary, bytecode

https://docs.python.org/3/glossary.html#term-bytecode

CPython bytecode terminology; interactivity is not exclusive to interpretation.

## Use policy

Review licenses before copying third-party code. Python documentation is a specification reference, not a runtime. Public protocol documentation does not prove that NAJA implements it. A name search is not trademark clearance. Productivity thresholds in documents 21–22 are founder requirements and proposed measurement contracts, not externally established speed or code-size results.
