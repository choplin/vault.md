# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **GitHub Actions CI/CD** - Automated testing and quality checks on push and pull requests
- **Entry Archive Feature** - Archive and restore vault entries with `vault archive` and `vault restore` commands, view archived entries with `vault list --include-archived`
- **Three-tier Scope System** - Organize your vault entries at three levels: global (across all projects), repository (specific to a project), or branch (specific to a git branch)
- **Smart Fallback Search** - When retrieving entries, automatically searches branch → repository → global scopes, ensuring you always get the most specific version available
- **Enhanced CLI Options** - New `--scope` option to specify where to store entries (global/repository/branch) and `--branch` option for branch-specific storage
- **Visual Scope Management** - Web UI now displays color-coded scope badges (purple for global, blue for repository, green for branch) making it easy to see where each entry is stored
- **MCP Scope Support** - MCP server now accepts scope parameters, allowing AI tools to store and retrieve context at the appropriate level

### Fixed

- Added `vault.md` command to bin field for proper npx execution

## [0.1.0] - 2025-07-19

### Added

- Initial release of vault.md - Context-Aware Storage for AI-Driven Development
- **CLI Interface** - Simple commands to store and retrieve context across AI sessions
- **Multi-scope Storage** - Organize entries globally or per-repository with automatic git detection
- **Version Control** - Every save creates a new version, never lose your work
- **Web UI** - Visual interface for browsing and managing your knowledge vault at <http://localhost:8080>
- **MCP Server** - Direct integration with Claude Desktop and other AI tools
- **Human-readable Storage** - Plain text files you can edit with any editor

[unreleased]: https://github.com/username/vault.md/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/username/vault.md/releases/tag/v0.1.0
