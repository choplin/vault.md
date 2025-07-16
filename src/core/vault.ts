import { readFileSync } from 'node:fs'
import type { DatabaseContext } from './database.js'
import * as db from './database.js'
import * as fs from './filesystem.js'
import { ensureGitRepo } from './git.js'
import { formatScope, isGlobalScope, type Scope } from './scope.js'
import type { ListOptions, SetOptions, VaultEntry, VaultOptions } from './types.js'

export interface VaultContext {
  database: DatabaseContext
  scope: Scope
  scopeId: number
}

export interface CreateVaultOptions {
  global?: boolean
  repo?: string
  branch?: string
}

export function createVault(options: CreateVaultOptions = {}): VaultContext {
  const database = db.createDatabase()

  // Determine scope
  let scope: Scope

  if (options.global) {
    scope = { type: 'global' }
  } else if (options.repo) {
    // Specific repo provided
    const gitInfo = ensureGitRepo(options.repo)
    scope = {
      type: 'repo',
      identifier: gitInfo.repoRoot!,
      branch: options.branch || gitInfo.currentBranch!,
      workPath: process.cwd(),
      remoteUrl: gitInfo.remoteUrl,
    }
  } else {
    // Current directory
    const gitInfo = ensureGitRepo()
    scope = {
      type: 'repo',
      identifier: gitInfo.repoRoot!,
      branch: options.branch || gitInfo.currentBranch!,
      workPath: process.cwd(),
      remoteUrl: gitInfo.remoteUrl,
    }
  }

  // Get or create scope in database
  const scopeId = db.getOrCreateScope(database, scope)

  return {
    database,
    scope,
    scopeId,
  }
}

export function setEntry(ctx: VaultContext, key: string, filePath: string, options: SetOptions = {}): string {
  // Read content from file or stdin
  let content: string
  if (filePath === '-') {
    content = readFileSync(0, 'utf-8')
  } else {
    content = fs.readFile(filePath)
  }

  // Get next version
  const version = db.getNextScopedVersion(ctx.database, ctx.scopeId, key)

  // Generate scope-specific path for file storage
  const scopePath = isGlobalScope(ctx.scope)
    ? 'global'
    : `${ctx.scope.identifier}/${ctx.scope.branch}`.replace(/[/\\:]/g, '_')

  // Save file
  const { path, hash } = fs.saveFile(scopePath, key, version, content)

  // Save to database
  db.insertScopedEntry(ctx.database, {
    scopeId: ctx.scopeId,
    version,
    key,
    filePath: path,
    hash,
    description: options.description,
  })

  return path
}

export function getEntry(ctx: VaultContext, key: string, options: VaultOptions = {}): string | undefined {
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  if (options.global || options.repo || options.branch) {
    const altScope = resolveScope(options)
    scopeId = db.getOrCreateScope(ctx.database, altScope)
  }

  const entry = options.version
    ? db.getScopedEntry(ctx.database, scopeId, key, options.version)
    : db.getLatestScopedEntry(ctx.database, scopeId, key)

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
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  let scope = ctx.scope
  if (options.global || options.repo || options.branch) {
    scope = resolveScope(options)
    scopeId = db.getOrCreateScope(ctx.database, scope)
  }

  const scopedEntries = db.listScopedEntries(ctx.database, scopeId, options.allVersions)

  // Convert to VaultEntry format
  return scopedEntries.map((entry) => ({
    id: entry.id,
    scopeId: entry.scopeId,
    scope: formatScope(scope),
    version: entry.version,
    key: entry.key,
    filePath: entry.filePath,
    hash: entry.hash,
    description: entry.description,
    createdAt: entry.createdAt,
  }))
}

export function deleteEntry(ctx: VaultContext, key: string, options: VaultOptions = {}): boolean {
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  if (options.global || options.repo || options.branch) {
    const altScope = resolveScope(options)
    scopeId = db.getOrCreateScope(ctx.database, altScope)
  }

  // Get entries to delete
  const entries = options.version
    ? [db.getScopedEntry(ctx.database, scopeId, key, options.version)].filter(Boolean)
    : db.listScopedEntries(ctx.database, scopeId, true).filter((e) => e.key === key)

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
  return db.deleteScopedEntry(ctx.database, scopeId, key, options.version)
}

export function getInfo(ctx: VaultContext, key: string, options: VaultOptions = {}): VaultEntry | undefined {
  // Handle different scope if specified
  let scopeId = ctx.scopeId
  let scope = ctx.scope
  if (options.global || options.repo || options.branch) {
    scope = resolveScope(options)
    scopeId = db.getOrCreateScope(ctx.database, scope)
  }

  const entry = options.version
    ? db.getScopedEntry(ctx.database, scopeId, key, options.version)
    : db.getLatestScopedEntry(ctx.database, scopeId, key)

  if (!entry) {
    return undefined
  }

  // Convert to VaultEntry format
  return {
    id: entry.id,
    scopeId: entry.scopeId,
    scope: formatScope(scope),
    version: entry.version,
    key: entry.key,
    filePath: entry.filePath,
    hash: entry.hash,
    description: entry.description,
    createdAt: entry.createdAt,
  }
}

export function closeVault(ctx: VaultContext): void {
  db.closeDatabase(ctx.database)
}

export function clearVault(ctx: VaultContext): void {
  db.clearDatabase(ctx.database)
}

// Helper function to resolve scope from options
function resolveScope(options: VaultOptions): Scope {
  if (options.global) {
    return { type: 'global' }
  }

  if (options.repo) {
    const gitInfo = ensureGitRepo(options.repo)
    return {
      type: 'repo',
      identifier: gitInfo.repoRoot!,
      branch: options.branch || gitInfo.currentBranch!,
      workPath: process.cwd(),
      remoteUrl: gitInfo.remoteUrl,
    }
  }

  // Current directory with different branch
  const gitInfo = ensureGitRepo()
  return {
    type: 'repo',
    identifier: gitInfo.repoRoot!,
    branch: options.branch || gitInfo.currentBranch!,
    workPath: process.cwd(),
    remoteUrl: gitInfo.remoteUrl,
  }
}

export type { Scope } from './scope.js'
// Export scope-related functions for use in other modules
export { formatScope, formatScopeShort } from './scope.js'
