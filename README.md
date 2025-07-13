# ccvault

A knowledge vault for Claude Code - persistent storage for AI-assisted development workflows.

## Overview

ccvault is a simple key-value store designed specifically for Claude Code, providing persistent storage for knowledge, context, and work artifacts across AI sessions.

## Features

- 🗂️ **Multi-dimensional key structure** - Organized by project, key, and version
- 📝 **Text file storage** - Human-readable and AI-editable files
- 🔄 **Automatic versioning** - Track changes over time
- 🖥️ **CLI and MCP interfaces** - Use from terminal or Claude Code
- 🔍 **Project isolation** - Keep knowledge separated by project

## Installation

```bash
npm install -g ccvault
```

Or run directly with npx:

```bash
npx ccvault <command>
```

## Quick Start

### CLI Usage

```bash
# Save content from stdin (default)
echo "API design notes" | ccvault set api-notes

# Save interactively
ccvault set notes
# Enter content (Ctrl-D when done):
# Type your content here...
# ^D

# Save from a file
ccvault set architecture -f design.md

# Save with description
ccvault set config -d "Production config" -f config.yaml

# Get file path (for editing)
vim $(ccvault get architecture)

# View content directly
ccvault cat architecture

# List all keys in current project
ccvault list

# Get specific version
ccvault get architecture --version=1
```

### MCP Server Usage

ccvault includes an MCP (Model Context Protocol) server that allows Claude Desktop to interact with your vault directly.

#### Setup

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ccvault": {
      "command": "ccvault",
      "args": ["mcp"]
    }
  }
}
```

Or if installed locally:

```json
{
  "mcpServers": {
    "ccvault": {
      "command": "node",
      "args": ["/path/to/ccvault/dist/cli.js", "mcp"]
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

- `vault_get` - Retrieve content from the vault
  - `key` (required): The key to retrieve
  - `version` (optional): Specific version (latest if not specified)

- `vault_list` - List all entries in the vault
  - `allVersions` (optional): Include all versions, not just latest

- `vault_delete` - Delete an entry from the vault
  - `key` (required): The key to delete
  - `version` (optional): Specific version to delete (all if not specified)

- `vault_info` - Get metadata about a vault entry
  - `key` (required): The key to get info for
  - `version` (optional): Specific version (latest if not specified)

## Key Concepts

### Projects

Each project (identified by its full path) maintains its own isolated knowledge base.

### Keys

User-defined identifiers for stored content (e.g., `architecture`, `api-design`, `meeting-notes`).

### Versions

Every update creates a new version automatically. Old versions are preserved for history.

## Storage Location

Data is stored in `~/.ccvault/` with this structure:

```text
~/.ccvault/
├── index.db                              # SQLite metadata
└── objects/
    └── -Users-yourname-project/         # Project directory
        ├── architecture_1.txt            # Version 1
        ├── architecture_2.txt            # Version 2
        └── api-notes_1.txt
```

## License

MIT
