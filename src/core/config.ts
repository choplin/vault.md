import { homedir } from 'node:os'
import { join } from 'node:path'

export function getVaultDir(): string {
  // 1. Explicit override via environment variable
  if (process.env.VAULT_DIR) {
    return process.env.VAULT_DIR
  }

  // 2. XDG Base Directory compliant path
  const xdgDataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share')
  return join(xdgDataHome, 'vault.md')
}

export function getDbPath(): string {
  return join(getVaultDir(), 'index.db')
}

export function getObjectsDir(): string {
  return join(getVaultDir(), 'objects')
}

export function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/[/._]/g, '-')
}
