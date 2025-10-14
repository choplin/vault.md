export type ScopePayload =
  | { type: 'global' }
  | { type: 'repository'; primaryPath: string }
  | { type: 'branch'; primaryPath: string; branchName: string }

export interface VaultEntry {
  id?: number
  scopeId?: number
  key: string
  description?: string
  scope: ScopePayload
  version?: number
  filePath?: string
  hash?: string
  createdAt?: string
  updatedAt?: string
  isArchived?: boolean
  versions?: VaultEntry[]
}

export interface ScopeGroup {
  scope: ScopePayload
  entries: VaultEntry[]
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export const api = {
  async getCurrentScope(): Promise<ScopePayload> {
    const res = await fetch('/api/current-scope')
    if (!res.ok) throw new Error('Failed to fetch current scope')
    const data = (await res.json()) as { scope: ScopePayload }
    return data.scope
  },

  async getAllEntries(): Promise<{ currentScope: ScopePayload; scopes: ScopeGroup[] }> {
    const res = await fetch('/api/entries/all')
    if (!res.ok) throw new Error('Failed to fetch entries')
    const data = (await res.json()) as { currentScope: ScopePayload; scopes: ScopeGroup[] }
    return data
  },

  async getScopeEntries(scope: ScopePayload, allVersions = false): Promise<ScopeGroup> {
    const res = await fetch('/api/scope/entries', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ scope, allVersions }),
    })
    if (!res.ok) throw new Error('Failed to fetch scope entries')
    const data = (await res.json()) as ScopeGroup
    return data
  },

  async getEntry(scope: ScopePayload, key: string, version?: number): Promise<{ content: string; filePath?: string }> {
    const res = await fetch('/api/entry/content', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ scope, key, version }),
    })
    if (!res.ok) throw new Error('Failed to fetch entry content')
    return (await res.json()) as { content: string; filePath?: string }
  },
}

export async function deleteEntry(scope: ScopePayload, key: string, version?: number): Promise<void> {
  const res = await fetch('/api/entry', {
    method: 'DELETE',
    headers: jsonHeaders,
    body: JSON.stringify({ scope, key, version }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to delete entry')
  }
}

export async function deleteScope(scope: ScopePayload, cascade = false): Promise<void> {
  const res = await fetch('/api/scope', {
    method: 'DELETE',
    headers: jsonHeaders,
    body: JSON.stringify({ scope, cascade }),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to delete scope')
  }
}
