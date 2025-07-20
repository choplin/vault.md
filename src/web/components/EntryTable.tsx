import { createMemo, createSignal, For, Show } from 'solid-js'
import { deleteEntry, type VaultEntry } from '../lib/api'
import { type SortColumn, searchQuery, setTableSort, setViewMode, showAllVersions, tableSort } from '../stores/ui'
import { refreshEntries, setSelectedEntry } from '../stores/vault'

interface EntryTableProps {
  entries: VaultEntry[]
  scope: string
}

interface DeleteConfirmation {
  entry: VaultEntry
  type: 'version' | 'key'
}

export default function EntryTable(props: EntryTableProps) {
  const [deleteConfirm, setDeleteConfirm] = createSignal<DeleteConfirmation | null>(null)
  const [deleting, setDeleting] = createSignal(false)
  // Filter and sort entries
  const filteredAndSortedEntries = createMemo(() => {
    let entries = [...props.entries]

    // Filter by search query
    const query = searchQuery().toLowerCase()
    if (query) {
      entries = entries.filter(
        (entry) => entry.key.toLowerCase().includes(query) || entry.description?.toLowerCase().includes(query) || '',
      )
    }

    // Filter by version preference
    if (!showAllVersions()) {
      // Group by key and take only the latest version
      const latestByKey = new Map<string, VaultEntry>()
      entries.forEach((entry) => {
        const existing = latestByKey.get(entry.key)
        if (!existing || (entry.version || 1) > (existing.version || 1)) {
          latestByKey.set(entry.key, entry)
        }
      })
      entries = Array.from(latestByKey.values())
    }

    // Sort entries
    const sort = tableSort()
    entries.sort((a, b) => {
      let aVal: string | number | Date
      let bVal: string | number | Date

      switch (sort.column) {
        case 'key':
          aVal = a.key
          bVal = b.key
          break
        case 'version':
          aVal = a.version || 1
          bVal = b.version || 1
          break
        case 'description':
          aVal = a.description || ''
          bVal = b.description || ''
          break
        case 'createdAt':
          aVal = new Date(a.createdAt || a.created_at || '')
          bVal = new Date(b.createdAt || b.created_at || '')
          break
      }

      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1
      return 0
    })

    return entries
  })

  function toggleSort(column: SortColumn) {
    const current = tableSort()
    if (current.column === column) {
      setTableSort({
        column,
        direction: current.direction === 'asc' ? 'desc' : 'asc',
      })
    } else {
      setTableSort({ column, direction: 'asc' })
    }
  }

  function selectEntry(entry: VaultEntry) {
    setSelectedEntry({
      scope: props.scope,
      key: entry.key,
      version: entry.version,
    })
    setViewMode('content')
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60))
        return `${diffMins}m ago`
      }
      return `${diffHours}h ago`
    } else if (diffDays < 7) {
      return `${diffDays}d ago`
    } else if (diffDays < 30) {
      return `${Math.floor(diffDays / 7)}w ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const SortIcon = (props: { column: SortColumn }) => {
    const sort = tableSort()
    if (sort.column !== props.column) {
      return <span class="text-base-content/30">↕</span>
    }
    return <span class="text-primary">{sort.direction === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>
              <button type="button" onClick={() => toggleSort('key')} class="flex items-center gap-1 font-semibold">
                Key <SortIcon column="key" />
              </button>
            </th>
            <th>
              <button type="button" onClick={() => toggleSort('version')} class="flex items-center gap-1 font-semibold">
                Version <SortIcon column="version" />
              </button>
            </th>
            <th>
              <button
                type="button"
                onClick={() => toggleSort('description')}
                class="flex items-center gap-1 font-semibold"
              >
                Description <SortIcon column="description" />
              </button>
            </th>
            <th>
              <button
                type="button"
                onClick={() => toggleSort('createdAt')}
                class="flex items-center gap-1 font-semibold"
              >
                Created <SortIcon column="createdAt" />
              </button>
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <Show
            when={filteredAndSortedEntries().length > 0}
            fallback={
              <tr>
                <td colspan="5" class="text-center text-base-content/60 py-8">
                  No entries found
                </td>
              </tr>
            }
          >
            <For each={filteredAndSortedEntries()}>
              {(entry) => (
                <tr class="hover cursor-pointer" onClick={() => selectEntry(entry)}>
                  <td class="font-medium">{entry.key}</td>
                  <td>{entry.version || 1}</td>
                  <td class="max-w-md truncate text-base-content/80">{entry.description || '-'}</td>
                  <td class="text-base-content/60">{formatDate(entry.createdAt || entry.created_at || '')}</td>
                  <td>
                    <div class="dropdown dropdown-end">
                      <button
                        type="button"
                        tabindex="0"
                        class="btn btn-ghost btn-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="1.5"
                          stroke="currentColor"
                          class="w-5 h-5"
                          role="img"
                          aria-label="More options"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
                          />
                        </svg>
                      </button>
                      <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                        <li>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirm({ entry, type: 'key' })
                            }}
                          >
                            Delete key
                          </button>
                        </li>
                        <Show when={showAllVersions()}>
                          <li>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteConfirm({ entry, type: 'version' })
                              }}
                            >
                              Delete version {entry.version || 1}
                            </button>
                          </li>
                        </Show>
                      </ul>
                    </div>
                  </td>
                </tr>
              )}
            </For>
          </Show>
        </tbody>
      </table>

      {/* Delete confirmation modal */}
      <Show when={deleteConfirm()}>
        {(confirm) => (
          <div class="modal modal-open" role="dialog" aria-modal="true">
            <div class="modal-box">
              <h3 class="font-bold text-lg">Confirm Deletion</h3>
              <p class="py-4">
                {confirm().type === 'version'
                  ? `Delete version ${confirm().entry.version} of '${confirm().entry.key}'?`
                  : `Delete all versions of key '${confirm().entry.key}'? This key will be permanently removed.`}
              </p>
              <div class="modal-action">
                <button type="button" class="btn" onClick={() => setDeleteConfirm(null)} disabled={deleting()}>
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn btn-error"
                  disabled={deleting()}
                  onClick={async () => {
                    setDeleting(true)
                    try {
                      await deleteEntry(
                        confirm().entry.scope,
                        confirm().entry.key,
                        confirm().type === 'version' ? confirm().entry.version : undefined,
                      )
                      setDeleteConfirm(null)
                      // Refresh the entries list
                      await refreshEntries()
                    } catch (error) {
                      console.error('Failed to delete:', error)
                      alert('Failed to delete entry')
                    } finally {
                      setDeleting(false)
                    }
                  }}
                >
                  {deleting() ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}
