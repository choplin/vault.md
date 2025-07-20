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

// Parse scope string to extract identifier and branch
function parseScopeString(scope: string): { identifier: string; branch: string } {
  if (scope === 'Global' || scope === 'global') {
    return { identifier: 'global', branch: 'global' }
  }

  // Parse "repoPath (branch)" format
  const match = scope.match(/^(.+) \((.+)\)$/)
  if (match) {
    return { identifier: match[1], branch: match[2] }
  }

  // Fallback
  return { identifier: scope, branch: 'default' }
}

export async function deleteEntry(scope: string, key: string, version?: number): Promise<void> {
  const { identifier, branch } = parseScopeString(scope)

  const path = version
    ? `/api/entries/${encodeURIComponent(identifier)}/${encodeURIComponent(branch)}/${encodeURIComponent(key)}/${version}`
    : `/api/entries/${encodeURIComponent(identifier)}/${encodeURIComponent(branch)}/${encodeURIComponent(key)}`

  const res = await fetch(path, { method: 'DELETE' })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to delete entry')
  }
}

export async function deleteScope(identifier: string, branch: string): Promise<void> {
  const path = `/api/branches/${encodeURIComponent(identifier)}/${encodeURIComponent(branch)}`
  const res = await fetch(path, { method: 'DELETE' })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to delete scope')
  }
}

export async function deleteIdentifier(identifier: string): Promise<void> {
  const path = `/api/identifiers/${encodeURIComponent(identifier)}`
  const res = await fetch(path, { method: 'DELETE' })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to delete identifier')
  }
}
