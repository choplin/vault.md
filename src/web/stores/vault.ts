import { createMemo, createSignal } from 'solid-js'
import type { ScopeGroup } from '../lib/api'

export const [currentScope, setCurrentScope] = createSignal<string>('')
export const [scopes, setScopes] = createSignal<ScopeGroup[]>([])
export const [selectedEntry, setSelectedEntry] = createSignal<{
  scope: string
  key: string
  version?: number
} | null>(null)
export const [entryContent, setEntryContent] = createSignal<string>('')
export const [loading, setLoading] = createSignal(true)
export const [contentLoading, setContentLoading] = createSignal(false)
export const [error, setError] = createSignal<string | null>(null)

export const selectedEntryInfo = createMemo(() => {
  const selected = selectedEntry()
  const scopesList = scopes()

  if (!selected) return null

  for (const scope of scopesList) {
    const entry = scope.entries.find((e) => e.scope === selected.scope && e.key === selected.key)
    if (entry) return entry
  }
  return null
})
