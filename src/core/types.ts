import type { ScopeType } from './scope.js'

export type { ScopeType } from './scope.js'

export interface VaultEntry {
  id: number
  scopeId: number
  scope: string // Formatted scope string
  version: number
  key: string
  filePath: string
  hash: string
  description?: string
  createdAt: Date
  isArchived: boolean
}

export interface VaultOptions {
  // Scope options
  scope?: ScopeType
  repo?: string
  branch?: string

  // Search options
  allScopes?: boolean

  // Version option
  version?: number
}

export interface ListOptions extends VaultOptions {
  allVersions?: boolean
  json?: boolean
  includeArchived?: boolean
}

export interface SetOptions extends VaultOptions {
  description?: string
}
