# vault.md

A knowledge vault for AI-assisted development with versioned, scoped content storage.

[![CI](https://github.com/vault-md/vaultmd/actions/workflows/ci.yml/badge.svg)](https://github.com/vault-md/vaultmd/actions/workflows/ci.yml)
[![Release](https://github.com/vault-md/vaultmd/actions/workflows/release.yml/badge.svg)](https://github.com/vault-md/vaultmd/actions/workflows/release.yml)
[![Go Report Card](https://goreportcard.com/badge/github.com/vault-md/vaultmd)](https://goreportcard.com/report/github.com/vault-md/vaultmd)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **📦 Scoped Storage**: Store content scoped to repositories, branches, worktrees, or globally
- **🔄 Version Control**: Automatic versioning with SHA256 hash verification
- **🔍 Git Integration**: Automatic git repository detection for smart scope resolution
- **🤖 MCP Support**: Model Context Protocol server for AI integration
- **💻 CLI Interface**: Intuitive command-line interface with table and JSON output
- **✏️ Editor Integration**: Edit entries with your favorite `$EDITOR`

## Installation

### Homebrew (macOS/Linux)

```bash
brew install choplin/tap/vault
```

### From Source

Requires Go 1.25 or later:

```bash
go install github.com/vault-md/vaultmd/cmd/vault@latest
```

### Manual Installation

Download the latest release from [GitHub Releases](https://github.com/vault-md/vaultmd/releases).

## Usage

### Basic Commands

```bash
# Save content
vault set my-note "This is my note"

# Get content
vault get my-note

# List all entries
vault list

# Show entry info
vault info my-note

# Edit with $EDITOR
vault edit my-note

# Delete entry
vault delete my-note
```

### Scoped Storage

vault.md automatically detects your git repository and uses appropriate scopes:

```bash
# Inside a git repository → automatically uses 'repository' scope
vault set project-notes "Notes for this project"

# Outside git repository → uses 'global' scope
vault set global-notes "Notes available everywhere"

# Explicitly specify scope
vault set --scope branch feature-notes "Notes for this branch"
```

### Version Management

```bash
# Save multiple versions
vault set my-note "Version 1"
vault set my-note "Version 2"
vault set my-note "Version 3"

# Get specific version
vault get my-note --version 1

# List all versions
vault list --all-versions
```

### Output Formats

```bash
# Table output (default)
vault list

# JSON output
vault list --output json
vault info my-note --output json
```

### MCP Server

Start the Model Context Protocol server for AI integration:

```bash
vault mcp
```

Available MCP tools:
- `vault_set`: Store content
- `vault_get`: Retrieve content
- `vault_list`: List entries
- `vault_info`: Get metadata
- `vault_delete`: Delete entries

## Scopes

vault.md supports four scope levels:

| Scope | Description | Auto-detected |
|-------|-------------|---------------|
| `global` | Available everywhere | When outside git repo |
| `repository` | Repository-specific | When inside git repo |
| `branch` | Branch-specific | Manual |
| `worktree` | Worktree-specific | Manual |

## Configuration

vault.md stores data in XDG-compliant directories:

- **Database**: `~/.local/share/vault.md/vault.db`
- **Content**: `~/.local/share/vault.md/content/`

## Development

### Prerequisites

- Go 1.25+
- make

### Build

```bash
# Build binary
make build

# Run tests
make test

# Run linters
make lint

# Format code
make fmt
```

### Run from Source

```bash
go run ./cmd/vault [command]
```

## Architecture

vault.md follows clean architecture principles:

```
cmd/vault/          CLI layer (Cobra commands)
internal/mcp/       MCP layer (Model Context Protocol)
internal/usecase/   Application layer (use cases)
internal/services/  Domain services
internal/database/  Data access layer (sqlc)
internal/filesystem/ File operations
internal/git/       Git repository detection
internal/scope/     Scope resolution
```

## Technology Stack

- **Language**: Go 1.25
- **Database**: SQLite with [sqlc](https://sqlc.dev/)
- **CLI**: [Cobra](https://cobra.dev/)
- **Tables**: [go-pretty](https://github.com/jedib0t/go-pretty)
- **MCP**: [MCP SDK v1.1.0](https://github.com/modelcontextprotocol/go-sdk)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related Projects

- [TypeScript version](https://github.com/vault-md/vault.md) (original implementation)
