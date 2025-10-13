---
created: 2025-10-11
updated: 2025-10-11
---

# Scope Refactor Design

## Overview

The project is preparing to introduce a dedicated **worktree scope** alongside the existing global, repository, and branch scopes. To make the addition sustainable, the entire Scope model needs to be redesigned so that every layer—runtime types, persistence, UI, and file layout—works off a consistent logical key. This document consolidates the goal, the target data model, and the phased implementation plan.

## Objectives

- Redefine the logical key that uniquely identifies each scope so that the future worktree scope can coexist cleanly.
- Align that logical key across in-memory types, database schema, UI/API contracts, and file storage.
- Remove dependencies on legacy fields such as `identifier`, `branch`, and `workPath`, making the model extensible.
- Track phased work so the team can complete the refactor before layering the new feature.

## Logical Keys

| Scope Type | Logical Key                                   | Normalisation Rules                                                                          | Notes                                              |
| ---------- | --------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Global     | _none_                                        | N/A                                                                                          | Single fixed scope; no additional key material.    |
| Repository | Primary worktree path                         | `realpath` result of primary worktree; case-sensitive comparison                             | `worktreePath` is optional metadata only.          |
| Worktree   | Primary worktree path + worktree key          | Worktree key is `basename(git rev-parse --git-dir)`; primary path is still canonicalised      | Git guarantees uniqueness of worktree keys.        |
| Branch     | Primary worktree path + branch name           | `realpath` for path, branch name is local (no `origin/` prefixes)                            | Worktree path remains auxiliary and may be absent. |

Supplemental metadata has been dropped; only the logical key components and display helpers remain.

### Path Normalisation

- Resolve every path with `realpath` before persisting or comparing; symlinks collapse to their canonical targets.
- Comparison remains case-sensitive even on case-insensitive filesystems.
- For each worktree capture:
  - `worktreeKey`: `basename(git rev-parse --git-dir)` (stable identifier provided by Git, guaranteed unique within the repo)
  - Optional `worktreePath`: absolute path of the worktree root (`git rev-parse --show-toplevel`) for display/filesystem convenience
- Only `primaryPath` and `worktreeKey` participate in logical identity; `worktreePath` is auxiliary metadata.

## Data Representation Guidelines

### In-memory model

- Types: `Scope = GlobalScope | RepositoryScope | BranchScope | WorktreeScope`.
- Required fields per type:
  - Repository: `primaryPath` (absolute), optional `worktreePath` (absolute).
  - Branch: `primaryPath` (absolute), `branchName`, optional `worktreePath`.
  - Worktree: `primaryPath` (absolute), `worktreeKey` (string derived from git). Optional `worktreePath` can be retained purely for display or filesystem operations, but it is not part of identity.
- Helper accessors (`getScopePrimaryPath`, `getScopeBranchName`, etc.) are the single source of truth; legacy properties are removed entirely.
- `resolveScope` emits canonicalised scopes, populating `worktreeKey` when a worktree is active and, if desired, including the optional `worktreePath` for downstream display helpers.

### Database schema

- Replace the `scopes` table with the following columns:
  - `type` TEXT NOT NULL — `global`, `repository`, `branch`, `worktree`.
  - `primary_path` TEXT NOT NULL — canonical absolute path of the primary worktree.
  - `worktree_key` TEXT — `basename(git rev-parse --git-dir)` for worktree scopes (nullable otherwise).
  - `worktree_path` TEXT — absolute path to the worktree root (nullable; populated only for worktree scopes).
  - `branch_name` TEXT — local branch name (nullable, required for branch scopes).
  - `scope_path` TEXT NOT NULL — cached filesystem-safe key used by the storage layer.
  - `created_at`, `updated_at` timestamps.
- Unique constraints:
  - `(type, primary_path, worktree_key, branch_name)` with NULL handling aligned to the scope type (worktree key distinguishes individual worktrees).
  - `scope_path` to prevent collisions introduced by sanitisation; operations must treat a UNIQUE violation as an error and surface it to the caller.

### File storage

- `getScopeStorageKey` sanitizes the canonical `formatScope(scope)` string and stores the result in `scope_path`.
- The sanitize helper replaces characters unsafe for filenames (`/`, `:`, `@`, `\`, etc.) with `-`. Worktree keys contain no path separators, so only branch names can collide; any collision surfaces via the `scope_path` UNIQUE constraint.
- Directory layout on disk mirrors `scope_path`, so deleting a scope removes the corresponding directory subtree.

### UI & API contracts

- All public surfaces adopt the in-memory structure without renaming (`primaryPath`, `branchName`, `worktreeKey`, optional `worktreePath`).
- HTTP requests carry scope information in a JSON body. Common shape:

  ```json
  {
    "scope": {
      "type": "branch",
      "primaryPath": "/Users/aki/workspace/app",
      "branchName": "feature/login"
    },
    "options": { "allVersions": true }
  }
  ```

- The `options` object is optional; clients may omit it or send an empty object when no extra parameters are required.
- Primary endpoints (all `POST` unless noted, responses are JSON as well):

  | Endpoint | Purpose | Required payload fields |
  | --- | --- | --- |
  | `/api/scopes/list-entries` | List entries for a scope | `scope`, optional `options.allVersions` |
  | `/api/scopes/get-entry` | Fetch a single entry | `scope`, `key`, optional `version` |
  | `/api/scopes/set-entry` | Create or update an entry | `scope`, `key`, `content` or `filePath`, optional `description` |
  | `/api/scopes/delete-entry` | Delete an entry/version | `scope`, `key`, optional `version` |
  | `/api/scopes/delete-scope` | Remove an entire scope | `scope` |
  | `/api/scopes/all` (`GET`) | Enumerate all scopes | no body |

- The server validates the incoming `scope` with `validateScope` and relies on `formatScope` / `getScopeStorageKey` for persistence and response formatting.
- Legacy URL parameters are removed; no URL encoding/decoding is required beyond standard JSON handling.

### Display rules

- `formatScope` (single source of truth for scope strings):
  - Global → `'global'`
  - Repository → absolute `primaryPath`
  - Branch → `<absolute primaryPath>:<branchName>`
  - Worktree → `<absolute primaryPath>@<worktreeKey>`
- `formatScopeShort`:
  - Global → `'global'`
  - Repository → `basename(primaryPath)`
  - Branch → `basename(primaryPath):<branchName>`
  - Worktree → `basename(primaryPath)@<worktreeKey>`
- Optional helpers may still present the absolute worktree path (or a relative version) in UI tooltips or detail views, but this information does not appear in the canonical string outputs.
- `formatScope`, `formatScopeShort`, and `getScopeStorageKey` are colocated in `src/core/scope.ts` so that updates to the canonical representation flow to storage keys and compact labels without divergence.
- UI components that previously relied on `formatScope`/`formatScopeShort` continue to do so, gaining the new behaviour automatically.

### Concrete examples

Using a primary repository located at `/Users/aki/workspace/app`:

| Scope kind | `formatScope(scope)` | `formatScopeShort(scope)` | Database row (type / primary_path / worktree_key / worktree_path / branch_name / scope_path) | API request example | Filesystem directory |
| --- | --- | --- | --- | --- | --- |
| Global | `global` | `global` | `global / NULL / NULL / NULL / NULL / global` | `POST /api/scopes/list-entries` with body `{ "scope": { "type": "global" } }` | `<vault-root>/global/` |
| Repository | `/Users/aki/workspace/app` | `app` | `repository / /Users/aki/workspace/app / NULL / NULL / NULL / -Users-aki-workspace-app` | `POST /api/scopes/list-entries` with body `{ "scope": { "type": "repository", "primaryPath": "/Users/aki/workspace/app" } }` | `<vault-root>/-Users-aki-workspace-app/` |
| Branch (`feature/login`) | `/Users/aki/workspace/app:feature/login` | `app:feature/login` | `branch / /Users/aki/workspace/app / NULL / NULL / feature/login / -Users-aki-workspace-app-feature-login` | `POST /api/scopes/list-entries` with body `{ "scope": { "type": "branch", "primaryPath": "/Users/aki/workspace/app", "branchName": "feature/login" } }` | `<vault-root>/-Users-aki-workspace-app-feature-login/` |
| Worktree (`git rev-parse --git-dir` → `/Users/aki/workspace/app/.git/worktrees/feature-login`) | `/Users/aki/workspace/app@feature-login` | `app@feature-login` | `worktree / /Users/aki/workspace/app / feature-login / /Users/aki/workspace/app/worktrees/feature-login / NULL / -Users-aki-workspace-app-feature-login` | `POST /api/scopes/list-entries` with body `{ "scope": { "type": "worktree", "primaryPath": "/Users/aki/workspace/app", "worktreeKey": "feature-login" } }` | `<vault-root>/-Users-aki-workspace-app-feature-login/` |

Notes:

- The branch example demonstrates that `/` inside the branch name survives in the formatted string but is sanitised to `-` in the storage key.
- The worktree example shows `worktreeKey = feature-login`, taken directly from `git rev-parse --git-dir`. Even if the worktree lives outside the primary directory, the key remains stable and collision-free within the repository. The optional `worktreePath` column can hold `/Users/aki/workspace/app/worktrees/feature-login` for display or filesystem lookups.

## Implementation Phases

### Phase 1: In-memory Scope Model

- Finalise scope type definitions, helper accessors, and canonicalisation logic (`resolveScope`, `getGitInfo`).
- Replace all remaining legacy field references across `vault.ts`, `ScopeRepository`, `ScopeService`, CLI, Web API, and MCP layers.
- Update unit and integration tests to assert against the new structure (including worktree canonicalisation expectations).

### Phase 2: Database Schema & Repository

- Introduce the new `scopes` schema and migrate data in place; remove all references to the legacy table layout.
- Rework repository queries (`ScopeRepository`, `ScopeEntryQuery`, etc.) to use the logical key columns and `scope_path`.
- Extend lifetime management routines (delete scope, delete worktree) to operate on the new schema, updating tests accordingly.

### Phase 3: Worktree Scope Feature

- Surface worktree scopes throughout CLI/Web/MCP, including selection, display, and deletion flows.
- Ensure storage layout and pruning handle `@`-based directories, including relative-path variants.
- Add regression tests covering multiple worktrees per repository and interaction with branch scopes.

## Progress Snapshot (as of 2025-02-14 work log)

### Completed

- Replaced the old `Scope` definitions and updated serialization helpers (validation, formatting, repository persistence adapters).
- Extended `getGitInfo` and adjusted scope unit tests.
- Began refactoring `vault.ts`, `ScopeRepository`, `ScopeService`, and CLI/web layers to rely on the new fields.

### Outstanding

- Finish removing legacy field access in `vault.ts`, `ScopeRepository`, and `ScopeService`.
- Update CLI/Web/API/frontend code paths to the new field names.
- Refresh CLI/Web/integration tests and restore `npm run test:unit` stability.
- After Phase 1, proceed with the database redesign (Phase 2) and finally introduce the worktree scope (Phase 3).

## Related Files

- `src/core/scope.ts`
- `src/core/git.ts`
- `src/core/vault.ts`
- `src/core/database/repositories/scope.repository.ts`
- `src/core/services/scope.service.ts`
- `src/web/*`
- `tests/*`

These modules cover the scope refactor surface area and should be reviewed when prioritizing subsequent tasks.
