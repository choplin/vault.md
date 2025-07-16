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

- `npm run dev:web` - APIサーバー(8080)とVite開発サーバー(5173)を同時起動
  - ログは色分けされて表示（API: マゼンタ、Vite: シアン）
  - Ctrl+Cで両方のサーバーを停止

### CLI Development

- `npm run dev` - CLIを実行（引数を追加可能）
  - 例: `npm run dev -- set key -d "description"`
  - 例: `npm run dev -- mcp` (MCPサーバー起動)
  - 例: `npm run dev -- web` (APIサーバー起動)

### Individual Servers

- `npm run dev:api` - APIサーバーのみ起動 (port 8080)
- `vite` - Vite開発サーバーのみ起動 (port 5173)
