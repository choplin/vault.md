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

  async getScopeEntries(primaryPath: string, branchName: string, allVersions = false): Promise<ScopeGroup> {
    const path = `/api/scopes/${encodeURIComponent(primaryPath)}/${encodeURIComponent(branchName)}/entries${
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

// Parse canonical scope strings emitted by the backend/UI helpers
function parseScopeString(scope: string): { primaryPath: string; branchName: string } {
  if (scope === 'global') {
    return { primaryPath: 'global', branchName: 'global' }
  }

  const colonIndex = scope.indexOf(':')
  if (colonIndex > 0 && colonIndex < scope.length - 1) {
    return {
      primaryPath: scope.substring(0, colonIndex),
      branchName: scope.substring(colonIndex + 1),
    }
  }

  // Repository scopes are represented solely by their primary path
  return { primaryPath: scope, branchName: 'repository' }
}

export async function deleteEntry(scope: string, key: string, version?: number): Promise<void> {
  const { primaryPath, branchName } = parseScopeString(scope)

  const path = version
    ? `/api/entries/${encodeURIComponent(primaryPath)}/${encodeURIComponent(branchName)}/${encodeURIComponent(key)}/${version}`
    : `/api/entries/${encodeURIComponent(primaryPath)}/${encodeURIComponent(branchName)}/${encodeURIComponent(key)}`

  const res = await fetch(path, { method: 'DELETE' })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to delete entry')
  }
}

export async function deleteScope(primaryPath: string, branchName: string): Promise<void> {
  const path = `/api/branches/${encodeURIComponent(primaryPath)}/${encodeURIComponent(branchName)}`
  const res = await fetch(path, { method: 'DELETE' })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to delete scope')
  }
}

export async function deleteIdentifier(primaryPath: string): Promise<void> {
  const path = `/api/identifiers/${encodeURIComponent(primaryPath)}`
  const res = await fetch(path, { method: 'DELETE' })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to delete identifier')
  }
}
