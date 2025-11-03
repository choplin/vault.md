---
title: Use Case Layer Responsibilities
description: Defines how CLI/MCP use cases coordinate services in the Go port
---

## Overview

The Go port separates domain orchestration into a dedicated use case layer so that
both the CLI and MCP interfaces reuse the same entry→service interactions. This layer sits above
`internal/services`, which still own the lower-level `sqlc`-backed operations.

```
CLI / MCP
   ↓
Use Cases (high-level verbs: Entry.Set, Entry.Get, …)
   ↓
Services (EntryService, ScopeService)
   ↓
sqlc-generated queries / filesystem helpers
```

## Responsibilities

### Use Case Layer (`internal/usecase`)
- Exposes user-facing verbs grouped in structs (e.g. `Entry.Set`, `Entry.Get`)
- Coordinates multiple services and auxiliary helpers (scope resolution, file persistence)
- Defines reusable option structs such as `ScopeOptions`
- Performs cross-cutting checks (e.g. file integrity) and returns domain metadata to callers

### Services (`internal/services`)
- Provide operations scoped to a single domain entity (Entry, Scope, …)
- Interact directly with `sqlc` queries within transactions
- Avoid CLI-specific concepts (flags, printing)
- Do not manage file content—only metadata

### CLI / MCP Adapters
- Parse user input (flags, command payloads) → build use case DTOs
- Invoke the relevant application use case
- Render results or errors back to the user (stdout, MCP response)

## Naming Guidelines

- Use case methods should reflect the action (e.g. `Entry.Set`, `Entry.Get`, `Entry.List`)
- Option structs hold grouped parameters (e.g. `ScopeOptions`)
- Services retain entity-centric naming (`EntryService`, `ScopeService`)

## Example Flow: `vault set`

1. CLI parses flags (`--scope`, `--repo`, …) and stdin/file, then instantiates `ScopeOptions`
2. `usecase.NewEntry(dbCtx).Set(...)` resolves the scope, computes the next version, writes file contents, and
   records metadata via services
3. CLI prints the stored file path; MCP would return it in a response payload
