export interface VaultEntry {
  id: number
  project: string
  version: number
  key: string
  filePath: string
  hash: string
  description?: string
  createdAt: Date
}

export interface VaultOptions {
  project?: string
  version?: number
}

export interface ListOptions extends VaultOptions {
  allVersions?: boolean
  json?: boolean
}

export interface SetOptions {
  description?: string
}
