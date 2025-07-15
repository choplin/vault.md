# vault.md Project-Specific Instructions

## Pre-Commit Checks

**ALWAYS run these checks before committing:**

1. **Format**: `npm run format`
2. **Lint**: `npm run lint`
3. **Build**: `npm run build`
4. **Test**: `npm test`

All checks must pass before creating a commit. Fix any errors before proceeding.

## Project Structure

- **CLI**: TypeScript CLI tool built with Commander.js
- **Web UI**: Svelte + Vite frontend with Tailwind CSS and daisyUI
- **Storage**: SQLite database with content-addressed storage
- **MCP Server**: Model Context Protocol integration

## Build Commands

- `npm run build:web` - Build web assets with Vite
- `npm run build:bundle` - Bundle CLI with esbuild
- `npm run build:types` - Generate TypeScript declarations
- `npm run build` - Run all build steps

## Development

- `npm run dev` - Run CLI in development mode
- `npm run dev:web` - Run Vite dev server for web UI
- `npm run dev:mcp` - Run MCP server in development mode
