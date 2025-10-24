---
created: 2025-10-23
updated: 2025-10-23
---

# Go Port Specification

## Overview

- Goal: reimplement the existing `vault.md` CLI and MCP server features in Go while leaving the web UI out of scope.
- The current TypeScript implementation (`src/cli.ts`, `src/core`, `src/mcp/server.ts`) defines the canonical behaviour. The Go port must match command-line UX, MCP protocol semantics, scope resolution rules, and the SQLite schema.
- Maintain full compatibility with the existing on-disk data (database and object files) so that either implementation can operate on the same vault storage.

## System Architecture

- Produce a single Go binary that exposes the CLI entry point and an `mcp` subcommand, mirroring the TypeScript layout.
- Structure shared code under `internal/`, separating concerns into configuration, filesystem persistence, Git inspection, database access, services, and high-level vault orchestration.
- Layering plan:
  - `config`: environment resolution (`VAULT_DIR`, XDG path rules).
  - `filesystem`: object file storage, hashing, key deletion helpers.
  - `git`: repository detection, current branch/worktree inspection.
  - `database`: SQLite connection factory, migrations, repositories, query helpers.
  - `services`: equivalents of `EntryService` and `ScopeService` implementing business rules.
  - `vault`: facade combining services for CLI/MCP commands.

## Data Storage Specification

- Database location: `GetVaultDir()/index.db` (SQLite), using `PRAGMA user_version` for schema versioning just like the TypeScript CLI.
- Version 1 schema (must match column names, types, indexes, and constraints):
  - `scopes` with unique `(type, primary_path, worktree_id, branch_name)` and unique `scope_path`.
  - `entries` with unique `(scope_id, key)` and `created_at` timestamp.
  - `entry_status` keyed by `entry_id`, tracking `is_archived`, `current_version`, `updated_at`.
  - `versions` with unique `(entry_id, version)`, storing `file_path`, `hash`, optional `description`.
- Migrations: apply sequentially when `user_version` is lower than the embedded `CURRENT_VERSION`; throw an error if the DB is newer than the binary.
- File storage:
  - Object files live under `GetObjectsDir()` as `objects/<encoded_scope>/<encoded_key>_v<version>.txt`.
  - `EncodeProjectPath` replaces `/`, `.`, `_` with `-`, matching the TS helper.
  - File hashes are SHA-256; verify on read and raise an error when mismatched.

## Scope Resolution Specification

- Supported scope types: `global`, `repository`, `branch`, `worktree`.
- Resolution follows `resolveScope` semantics: infer repository details via Git when not explicitly supplied.
- Validation rules reject reserved keywords (`global`, `repository`) reused as repo paths/branch names/worktree IDs.
- `formatScope` and `formatScopeShort` should output identical strings to the TS version for table displays and logs.
- Search order when `--all-scopes` is involved:
  - `global`: `[global]`
  - `repository`: `[repository, global]`
  - `branch` / `worktree`: `[current scope, repository(primaryPath), global]`
- `listEntriesWithScopes` replicates the implicit search order using current Git context when no explicit scope options are provided.

## CLI Specification

- Implement the same command set and options: `set`, `get`, `cat`, `list`, `delete`, `info`, `archive`, `restore`, `edit`, `move-scope`, `mcp`. (`ui` is intentionally omitted from the Go port.)
- Option validation must mirror the TS error messages (e.g. `--branch option can only be used with --scope branch`).
- Command behaviour highlights:
  - `set`: read from stdin unless `--file` is provided; print stored file path.
  - `get` / `cat`: write resolved content to stdout; exit with status 1 and `Key not found: <key>` when missing.
  - `list`: render either JSON (`--json`) or table output with the same columns, colours optional but nice-to-have.
  - `delete`: support version-specific deletion, scope-wide purges, branch-wide deletions, and confirmation prompts unless `--force`.
  - `info`: emit entry metadata as pretty JSON.
  - `archive` / `restore`: operate on entries within the resolved scope, echoing success or failure messages.
  - `edit`: open `$EDITOR`/`$VISUAL`/`vi`, detect content changes via hashing, and store a new version with description `Edited with <editor>`.
  - `move-scope`: move all versions of a key between scopes, enforcing distinct source/target and collision checks.
- Error handling: print `Error: <message>` to stderr and exit with code 1 when exceptions bubble up.

## MCP Server Specification

- The CLI `mcp` subcommand should instantiate an MCP server using STDIO transport, exposing the same tool list as the TS implementation.
- Required tools: `vault_set`, `vault_get`, `vault_list`, `vault_delete`, `vault_info`, `vault_delete_version`, `vault_delete_key`, `vault_delete_branch`, `vault_delete_scope`.
- Argument validation must match the Zod schemas (including optional fields and descriptions) and return textual responses identical to the Node version.
- `vault_set` writes content by creating a temporary file, invoking the shared `set` logic, then deleting the temp file.
- `vault_get` returns either the entry content or `Entry not found: <key>`.
- `vault_list` returns `No entries found in vault` for empty results, otherwise formats entries in a human-readable list.
- Ensure the underlying vault environment is closed on exit; register process exit hooks equivalent to TS `process.once('exit', ...)`.

## Compatibility & Migration

- Go binaries must operate on the same SQLite DB and object directories as the TypeScript CLI without migration.
- Enforce consistent locking semantics to prevent corruption when both implementations run concurrently (respect SQLite locking and transaction boundaries).
- Update release tooling to build and distribute Go binaries (`go build`, potential cross-compilation) while keeping npm-based installation available during transition.

## Open Questions

- Decide on the Git integration approach (shelling out to `git` vs. using a Go library such as `go-git`).
- Determine the MCP protocol implementation strategy—whether to port the SDK concepts manually or leverage an existing Go MCP helper if one is published.
- Clarify how closely we must mimic coloured table output in `list` (may depend on available Go libraries).
- Confirm whether the `ui` command should be reported as unsupported or hidden entirely in the Go CLI.
