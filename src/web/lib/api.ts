export interface VaultEntry {
  id?: number
  scopeId?: number
  key: string
  description?: string
  scope: string
  version?: number
  filePath?: string
  hash?: string
  createdAt?: string
  created_at?: string
  updated_at?: string
  versions?: VaultEntry[]
}

export interface ScopeGroup {
  scope: string
  entries: VaultEntry[]
}

export const api = {
  async getCurrentScope(): Promise<string> {
    const res = await fetch('/api/current-scope')
    if (!res.ok) throw new Error('Failed to fetch current scope')
    const data = (await res.json()) as { scope: string }
    return data.scope
  },

  async getAllEntries(): Promise<{ currentScope: string; scopes: ScopeGroup[] }> {
    const res = await fetch('/api/entries/all')
    if (!res.ok) throw new Error('Failed to fetch entries')
    const data = (await res.json()) as { currentScope: string; scopes: ScopeGroup[] }
    return data
  },

  async getScopeEntries(identifier: string, branch: string, allVersions = false): Promise<ScopeGroup> {
    const path = `/api/scopes/${encodeURIComponent(identifier)}/${encodeURIComponent(branch)}/entries${
      allVersions ? '?allVersions=true' : ''
    }`
    const res = await fetch(path)
    if (!res.ok) throw new Error('Failed to fetch scope entries')
    const data = (await res.json()) as ScopeGroup
    return data
  },

  async getEntry(scope: string, key: string, version?: number): Promise<string> {
    const path = version
      ? `/api/entry/${encodeURIComponent(scope)}/${encodeURIComponent(key)}/${version}`
      : `/api/entry/${encodeURIComponent(scope)}/${encodeURIComponent(key)}`

    const res = await fetch(path)
    if (!res.ok) throw new Error('Failed to fetch entry content')
    const data = (await res.json()) as { content: string }
    return data.content
  },
}
