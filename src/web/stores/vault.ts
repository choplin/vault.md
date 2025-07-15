import { createMemo, createSignal } from 'solid-js'
import type { ProjectGroup } from '../lib/api'

export const [currentProject, setCurrentProject] = createSignal<string>('')
export const [projects, setProjects] = createSignal<ProjectGroup[]>([])
export const [selectedEntry, setSelectedEntry] = createSignal<{
  project: string
  key: string
  version?: number
} | null>(null)
export const [entryContent, setEntryContent] = createSignal<string>('')
export const [loading, setLoading] = createSignal(true)
export const [contentLoading, setContentLoading] = createSignal(false)
export const [error, setError] = createSignal<string | null>(null)

export const selectedEntryInfo = createMemo(() => {
  const selected = selectedEntry()
  const projectsList = projects()

  if (!selected) return null

  for (const project of projectsList) {
    const entry = project.entries.find((e) => e.project === selected.project && e.key === selected.key)
    if (entry) return entry
  }
  return null
})
