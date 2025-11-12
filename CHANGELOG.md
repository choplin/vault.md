# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `list` command table output now adapts to terminal width with priority-based column sizing

## [0.1.0] - 2025-11-06

### Added

- **MCP Server**: Model Context Protocol server with 5 core tools (`vault_set`, `vault_get`, `vault_list`, `vault_delete`, `vault_info`)
- **CLI Commands**:
  - `edit` command: Edit entries with `$EDITOR` (or `$VISUAL`, default `vi`)
  - `delete` command: Delete entries with confirmation prompt (supports `--force` flag)
  - `info` command: Display entry metadata in table or JSON format
  - `cat` command: Output entry content to stdout
  - `list` command: List entries with table or JSON output
  - `mcp` command: Start MCP server
- **Git Auto-Detection**: Automatically detect git repository information for scope resolution
  - Default scope changed from `global` to `repository` when inside a git repository
  - Falls back to `global` scope when outside git repositories
- **Scope Options**: All commands support `--scope`, `--repo`, `--branch`, `--worktree` flags
- **Version Specification**: Support `--version` (shorthand `-v`) flag for get, cat, info, edit commands
- **Hybrid Parameter Pattern**: Cleaner API with required parameters as arguments and optional parameters as structs

### Changed

- **Flag Naming**: Renamed `--ver` to `--version` with `-v` shorthand across all commands for clarity
- **Default Scope**: Changed from `global` to `repository` (with git auto-detection)
- **get/cat Commands**: Both now output content instead of file paths (use `info` for file paths)
- **Architecture**: Moved `ResolveScope` from `internal/usecase` to `internal/scope` (domain layer)

### Removed

- **`--all-scopes` Flag**: Removed from get and cat commands for clearer, more predictable behavior

### Fixed

- Confirmation prompts now work correctly with `bufio.Reader`
- File integrity checks using SHA256 hash verification

### Documentation

- Added ADR-0001 for git auto-detection and default repository scope decision

## Architecture

### Core Components

- **CLI Layer**: Cobra-based commands (`cmd/vault/`)
- **MCP Layer**: Model Context Protocol server (`internal/mcp/`)
- **Usecase Layer**: Application logic (`internal/usecase/`)
- **Services Layer**: Domain services (`internal/services/`)
- **Database Layer**: SQLite with sqlc-generated code (`internal/database/`)
- **Filesystem Layer**: File operations with hash verification (`internal/filesystem/`)
- **Git Layer**: Git repository information detection (`internal/git/`)
- **Scope Layer**: Scope resolution and validation (`internal/scope/`)

### Technology Stack

- Go 1.25
- SQLite with sqlc
- Cobra for CLI
- go-pretty/v6 for table formatting
- MCP SDK v1.1.0 for Model Context Protocol

