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

### MCP Server

Start the MCP server:

```bash
ccvault mcp
```

Then Claude Code can use these tools:

- `ccvault_set` - Save content
- `ccvault_get` - Retrieve content
- `ccvault_list` - List available keys
- `ccvault_info` - Get metadata

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
