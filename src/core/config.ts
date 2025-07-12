import { homedir } from 'node:os'
import { join } from 'node:path'

export function getVaultDir(): string {
  return process.env.VAULT_DIR || join(homedir(), '.ccvault')
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
