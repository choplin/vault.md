export interface VaultEntry {
  key: string
  description: string
  project: string
  created_at: string
  updated_at: string
  versions?: VaultEntry[]
}

export interface ProjectGroup {
  project: string
  entries: VaultEntry[]
}

export const api = {
  async getCurrentProject(): Promise<string> {
    const res = await fetch('/api/current-project')
    if (!res.ok) throw new Error('Failed to fetch current project')
    const data = (await res.json()) as { project: string }
    return data.project
  },

  async getAllEntries(): Promise<{ currentProject: string; projects: ProjectGroup[] }> {
    const res = await fetch('/api/entries/all')
    if (!res.ok) throw new Error('Failed to fetch entries')
    const data = (await res.json()) as { currentProject: string; projects: ProjectGroup[] }
    return data
  },

  async getEntry(project: string, key: string, version?: number): Promise<string> {
    const path = version
      ? `/api/entry/${encodeURIComponent(project)}/${encodeURIComponent(key)}/${version}`
      : `/api/entry/${encodeURIComponent(project)}/${encodeURIComponent(key)}`

    const res = await fetch(path)
    if (!res.ok) throw new Error('Failed to fetch entry content')
    const data = (await res.json()) as { content: string }
    return data.content
  },
}
