import { createSignal } from 'solid-js'

// UI state management
export type SortColumn = 'key' | 'version' | 'description' | 'createdAt'
export type SortDirection = 'asc' | 'desc'

export interface TableSort {
  column: SortColumn
  direction: SortDirection
}

// Collapsed state for repository groups
const COLLAPSED_REPOS_KEY = 'vault-md-collapsed-repos'

function loadCollapsedRepos(): Set<string> {
  try {
    const stored = localStorage.getItem(COLLAPSED_REPOS_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch {
    return new Set()
  }
}

function saveCollapsedRepos(repos: Set<string>) {
  localStorage.setItem(COLLAPSED_REPOS_KEY, JSON.stringify(Array.from(repos)))
}

export const [collapsedRepos, setCollapsedReposRaw] = createSignal(loadCollapsedRepos())

export function setCollapsedRepos(repos: Set<string>) {
  setCollapsedReposRaw(repos)
  saveCollapsedRepos(repos)
}

export function toggleRepoCollapse(identifier: string) {
  const current = new Set(collapsedRepos())
  if (current.has(identifier)) {
    current.delete(identifier)
  } else {
    current.add(identifier)
  }
  setCollapsedRepos(current)
}

// Table sorting state
const DEFAULT_SORT: TableSort = { column: 'key', direction: 'asc' }
export const [tableSort, setTableSort] = createSignal<TableSort>(DEFAULT_SORT)

// Filter state
export const [searchQuery, setSearchQuery] = createSignal('')
export const [showAllVersions, setShowAllVersions] = createSignal(false)

// View state
export type ViewMode = 'table' | 'content'
export const [viewMode, setViewMode] = createSignal<ViewMode>('table')

// All Scopes section collapse state
const ALL_SCOPES_COLLAPSED_KEY = 'vault-md-all-scopes-collapsed'

export const [allScopesCollapsed, setAllScopesCollapsedRaw] = createSignal(
  localStorage.getItem(ALL_SCOPES_COLLAPSED_KEY) === 'true',
)

export function setAllScopesCollapsed(collapsed: boolean) {
  setAllScopesCollapsedRaw(collapsed)
  localStorage.setItem(ALL_SCOPES_COLLAPSED_KEY, String(collapsed))
}
