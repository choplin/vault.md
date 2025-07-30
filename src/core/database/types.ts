// Database row types
export interface DbScopeRow {
  id: number
  identifier: string
  branch: string
  scope_path: string
  work_path?: string
  remote_url?: string
  created_at: string
  updated_at: string
}

export interface DbEntryRow {
  id: number
  scope_id: number
  key: string
  created_at: string
}

export interface DbEntryStatusRow {
  entry_id: number
  is_archived: number
  current_version: number
  updated_at: string
}

export interface DbVersionRow {
  id: number
  entry_id: number
  version: number
  file_path: string
  hash: string
  description?: string
  created_at: string
}

// Domain types
export interface Entry {
  id: number
  scopeId: number
  key: string
  createdAt: Date
}

export interface EntryStatus {
  entryId: number
  isArchived: boolean
  currentVersion: number
  updatedAt: Date
}

export interface Version {
  id: number
  entryId: number
  version: number
  filePath: string
  hash: string
  description?: string
  createdAt: Date
}

// Unified interface for public API
export interface ScopedEntry {
  id: number
  scopeId: number
  version: number
  key: string
  filePath: string
  hash: string
  description?: string
  createdAt: Date
  isArchived: boolean
}
