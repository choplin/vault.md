import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { catEntry, getEntry, setEntry } from './index.js'
import type { VaultOptions } from './types.js'
import type { VaultContext } from './vault.js'

export interface EditOptions extends VaultOptions {
  // EditOptions now extends VaultOptions to include scope options
}

export function editEntry(vault: VaultContext, key: string, options: EditOptions = {}): boolean {
  // Get the file path for the entry
  const filePath = getEntry(vault, key, options)
  if (!filePath) {
    throw new Error(`Entry not found: ${key}`)
  }

  // Get current content
  const currentContent = catEntry(vault, key, options)
  if (currentContent === undefined) {
    throw new Error(`Failed to read entry: ${key}`)
  }

  // Create temporary file
  const tempDir = mkdtempSync(join(tmpdir(), 'vault-edit-'))
  const tempFile = join(tempDir, `${key}.md`)
  writeFileSync(tempFile, currentContent, 'utf-8')

  // Get editor from environment
  const editor = process.env.EDITOR || process.env.VISUAL || 'vi'

  // Open editor
  const result = spawnSync(editor, [tempFile], {
    stdio: 'inherit',
    shell: true,
  })

  if (result.status !== 0) {
    throw new Error(`Editor exited with status ${result.status}`)
  }

  // Read edited content
  const editedContent = readFileSync(tempFile, 'utf-8')

  // Check if content changed
  const currentHash = createHash('sha256').update(currentContent).digest('hex')
  const editedHash = createHash('sha256').update(editedContent).digest('hex')

  if (currentHash === editedHash) {
    // No changes
    return false
  }

  // Save as new version
  setEntry(vault, key, tempFile, {
    description: `Edited with ${editor}`,
  })

  return true
}
