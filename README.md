# vault.md

> Context-Aware Storage for AI-Driven Development

A persistent knowledge vault that bridges the gap between AI sessions - Store, version, and retrieve context with a simple CLI and Web UI.

## Overview

vault.md is a context engineering tool that provides persistent storage for knowledge, context, and work artifacts across AI development sessions. Like Markdown for your AI's memory.

Built for the era of [Context Engineering](https://x.com/karpathy/status/1937902205765607626), vault.md ensures your carefully crafted prompts, architectural decisions, and domain knowledge are never lost between sessions.

## Features

- 🗂️ **Scope-based organization** - Global entries or repository-specific knowledge
- 📝 **Text file storage** - Human-readable and AI-editable files
- 🔄 **Automatic versioning** - Track changes over time
- 🖥️ **CLI and MCP interfaces** - Use from terminal or Claude Code
- 🔍 **Context awareness** - Automatically uses current git repository and branch

## Installation

```bash
npm install -g vault.md
```

Or run directly with npx:

```bash
npx vault.md <command>
```

## Quick Start

### CLI Usage

```bash
# Save content from stdin (in current repository)
echo "API design notes" | vault set api-notes

# Save to global scope (accessible from anywhere)
vault set notes --global
# Enter content (Ctrl-D when done):
# Type your content here...
# ^D

# Save from a file
vault set architecture -f design.md

# Save with description
vault set config -d "Production config" -f config.yaml

# Get file path (for editing)
vim $(vault get architecture)

# View content directly
vault cat architecture

# List all keys in current scope
vault list

# List global entries
vault list --global

# List entries from specific repository
vault list --repo /path/to/repo

# Get specific version
vault get architecture --version=1
```

### MCP Server Usage

vault.md includes an MCP (Model Context Protocol) server that allows Claude Desktop and other AI tools to interact with your vault directly.

#### Setup

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "vault": {
      "command": "vault",
      "args": ["mcp"]
    }
  }
}
```

Or if installed locally:

```json
{
  "mcpServers": {
    "vault": {
      "command": "node",
      "args": ["/path/to/vault.md/dist/cli.js", "mcp"]
    }
  }
}
```

#### Available Tools

Once configured, Claude Desktop can use these tools:

- `vault_set` - Store content in the vault
  - `key` (required): The key for the vault entry
  - `content` (required): The content to store
  - `description` (optional): Description for the entry
  - `global` (optional): Use global scope instead of current repository
  - `repo` (optional): Use specific repository path
  - `branch` (optional): Use specific branch (with repo option)

- `vault_get` - Retrieve content from the vault
  - `key` (required): The key to retrieve
  - `version` (optional): Specific version (latest if not specified)
  - `global` (optional): Use global scope instead of current repository
  - `repo` (optional): Use specific repository path
  - `branch` (optional): Use specific branch (with repo option)

- `vault_list` - List all entries in the vault
  - `allVersions` (optional): Include all versions, not just latest
  - `global` (optional): Use global scope instead of current repository
  - `repo` (optional): Use specific repository path
  - `branch` (optional): Use specific branch (with repo option)

- `vault_delete` - Delete an entry from the vault
  - `key` (required): The key to delete
  - `version` (optional): Specific version to delete (all if not specified)
  - `global` (optional): Use global scope instead of current repository
  - `repo` (optional): Use specific repository path
  - `branch` (optional): Use specific branch (with repo option)

- `vault_info` - Get metadata about a vault entry
  - `key` (required): The key to get info for
  - `version` (optional): Specific version (latest if not specified)
  - `global` (optional): Use global scope instead of current repository
  - `repo` (optional): Use specific repository path
  - `branch` (optional): Use specific branch (with repo option)

### Web UI

vault.md includes a Web UI for browsing and managing your vault visually.

```bash
# Start the Web UI server (default port: 8080)
vault ui

# Use a custom port
vault ui --port 3000

# Start with specific scope
vault ui --scope global
vault ui --scope repository --repo /path/to/repo
```

Open <http://localhost:8080> in your browser to view the Web UI.

## Key Concepts

### Scopes

vault.md organizes knowledge into scopes:

- **Global Scope**: Accessible from anywhere, perfect for personal notes, templates, and cross-project knowledge
- **Repository Scope**: Tied to a specific git repository and branch, ideal for project-specific documentation and context

When you're in a git repository, vault.md automatically uses the repository scope. Use `--global` to explicitly use the global scope.

### Keys

User-defined identifiers for stored content (e.g., `architecture`, `api-design`, `meeting-notes`).

### Versions

Every update creates a new version automatically. Old versions are preserved for history.

## Storage Location

Data is stored following the XDG Base Directory specification:

- **Default**: `~/.local/share/vault.md/`
- **Custom**: Set `VAULT_DIR` environment variable
- **XDG Override**: Set `XDG_DATA_HOME` to change the base directory

Structure:

```text
~/.local/share/vault.md/
├── index.db                              # SQLite metadata
└── objects/
    ├── global/                           # Global scope entries
    │   ├── templates_v1.txt
    │   └── personal-notes_v1.txt
    └── -path-to-repo-main/              # Repository scope (repo path + branch)
        ├── architecture_v1.txt           # Version 1
        ├── architecture_v2.txt           # Version 2
        └── api-notes_v1.txt
```

## Development

To set up the development environment:

```bash
# Install dependencies
npm install

# Set up git hooks
npm run prepare:hooks
```

## License

MIT
