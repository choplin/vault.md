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
}

export interface VaultOptions {
  // Scope options
  global?: boolean
  repo?: string
  branch?: string

  // Version option
  version?: number
}

export interface ListOptions extends VaultOptions {
  allVersions?: boolean
  json?: boolean
}

export interface SetOptions extends VaultOptions {
  description?: string
}
