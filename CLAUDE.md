# vault.md Project-Specific Instructions

## Important Rules

- **NEVER commit changes without user approval**
  - After making changes, always show what was changed and wait for user confirmation
  - Do not automatically run `git commit` unless explicitly told to

## Changelog Management

- **Follow Keep a Changelog format** (<https://keepachangelog.com/>)
  - Group changes under: Added, Changed, Deprecated, Removed, Fixed, Security
  - Keep an [Unreleased] section at the top for ongoing work
  - Date releases in ISO format: YYYY-MM-DD
  - Link versions at the bottom of the file
  - Each version should compare to the previous one

## Pre-Commit Checks

**ALWAYS run before committing:**

```bash
npm run check
```

This command runs all necessary checks (format, lint, build, test) in one go.
All checks must pass before creating a commit. Fix any errors before proceeding.

## Project Structure

- **CLI**: TypeScript CLI tool built with Commander.js
- **Web UI**: SolidJS + Vite frontend with Tailwind CSS and daisyUI
- **Storage**: SQLite database with content-addressed storage
- **MCP Server**: Model Context Protocol integration

## Build Commands

- `npm run build:web` - Build web assets with Vite
- `npm run build:bundle` - Bundle CLI with esbuild
- `npm run build:types` - Generate TypeScript declarations
- `npm run build` - Run all build steps

## Development

### Web UI Development

- `npm run dev:web` - Start both API server (8080) and Vite dev server (5173)
  - Logs are color-coded (API: magenta, Vite: cyan)
  - Ctrl+C stops both servers

### CLI Development

- `npm run dev` - Run CLI (can add arguments)
  - Example: `npm run dev -- set key -d "description"`
  - Example: `npm run dev -- mcp` (start MCP server)
  - Example: `npm run dev -- web` (start API server)

### Individual Servers

- `npm run dev:api` - Start API server only (port 8080)
- `vite` - Start Vite dev server only (port 5173)
