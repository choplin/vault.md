import { readFileSync } from 'node:fs'
import { isatty } from 'node:tty'
import type { DatabaseContext } from './database.js'
import * as db from './database.js'
import * as fs from './filesystem.js'
import type { ListOptions, SetOptions, VaultEntry, VaultOptions } from './types.js'

export interface VaultContext {
  database: DatabaseContext
  project: string
}

export function createVault(project?: string): VaultContext {
  return {
    database: db.createDatabase(),
    project: project || process.cwd(),
  }
}

export function setEntry(ctx: VaultContext, key: string, filePath: string, options: SetOptions = {}): string {
  // Read content from file or stdin
  let content: string
  if (filePath === '-') {
    // Check if stdin is a TTY (interactive terminal)
    if (isatty(0)) {
      console.error('Enter content (Ctrl-D when done):')
    }
    content = readFileSync(0, 'utf-8')
  } else {
    content = fs.readFile(filePath)
  }

  // Get next version
  const version = db.getNextVersion(ctx.database, ctx.project, key)

  // Save file
  const { path, hash } = fs.saveFile(ctx.project, key, version, content)

  // Save to database
  db.insertEntry(ctx.database, {
    project: ctx.project,
    version,
    key,
    filePath: path,
    hash,
    description: options.description,
  })

  return path
}

export function getEntry(ctx: VaultContext, key: string, options: VaultOptions = {}): string | undefined {
  const project = options.project || ctx.project

  const entry = options.version
    ? db.getEntry(ctx.database, project, key, options.version)
    : db.getLatestEntry(ctx.database, project, key)

  if (!entry) {
    return undefined
  }

  // Verify file integrity
  if (!fs.verifyFile(entry.filePath, entry.hash)) {
    throw new Error(`File integrity check failed for ${key}`)
  }

  return entry.filePath
}

export function catEntry(ctx: VaultContext, key: string, options: VaultOptions = {}): string | undefined {
  const filePath = getEntry(ctx, key, options)

  if (!filePath) {
    return undefined
  }

  return fs.readFile(filePath)
}

export function listEntries(ctx: VaultContext, options: ListOptions = {}): VaultEntry[] {
  const project = options.project || ctx.project
  return db.listEntries(ctx.database, project, options.allVersions)
}

export function deleteEntry(ctx: VaultContext, key: string, options: VaultOptions = {}): boolean {
  const project = options.project || ctx.project

  // Get entries to delete
  const entries = options.version
    ? [db.getEntry(ctx.database, project, key, options.version)].filter(Boolean)
    : db.listEntries(ctx.database, project, true).filter((e) => e.key === key)

  if (entries.length === 0) {
    return false
  }

  // Delete files
  entries.forEach((entry) => {
    if (entry) {
      fs.deleteFile(entry.filePath)
    }
  })

  // Delete from database
  return db.deleteEntry(ctx.database, project, key, options.version)
}

export function getInfo(ctx: VaultContext, key: string, options: VaultOptions = {}): VaultEntry | undefined {
  const project = options.project || ctx.project

  return options.version
    ? db.getEntry(ctx.database, project, key, options.version)
    : db.getLatestEntry(ctx.database, project, key)
}

export function closeVault(ctx: VaultContext): void {
  db.closeDatabase(ctx.database)
}

export function clearVault(ctx: VaultContext): void {
  db.clearDatabase(ctx.database)
}
