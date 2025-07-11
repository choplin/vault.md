import { homedir } from 'node:os'
import { join } from 'node:path'

export const VAULT_DIR = join(homedir(), '.ccvault')
export const DB_PATH = join(VAULT_DIR, 'index.db')
export const OBJECTS_DIR = join(VAULT_DIR, 'objects')

export function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/[/._]/g, '-')
}
