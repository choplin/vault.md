import { createMemo, createSignal, For, Show } from 'solid-js'
import { deleteEntry, type VaultEntry } from '../lib/api'
import { countEntriesInGroup, type EntryGroup, groupEntriesByPath } from '../lib/grouping'
import { searchQuery, setViewMode, showAllVersions } from '../stores/ui'
import { refreshEntries, setSelectedEntry } from '../stores/vault'
import { getEntryScopeInfo } from './EntryTable.js'

interface GroupedEntryViewProps {
  entries: VaultEntry[]
  scope: string
}

interface GroupItemProps {
  group: EntryGroup
  scope: string
  level: number
}

interface DeleteConfirmation {
  entry: VaultEntry
  type: 'version' | 'key'
}

function GroupItem(props: GroupItemProps) {
  const [isExpanded, setIsExpanded] = createSignal(true)
  const [deleteConfirm, setDeleteConfirm] = createSignal<DeleteConfirmation | null>(null)
  const [deleting, setDeleting] = createSignal(false)

  const hasContent = createMemo(() => props.group.entries.length > 0 || props.group.children.length > 0)

  const entryCount = createMemo(() => countEntriesInGroup(props.group))

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

  const paddingLeft = `${props.level * 1.5}rem`

  return (
    <Show when={hasContent()}>
      <Show when={props.group.name}>
        <button
          type="button"
          class="group flex items-center gap-2 px-4 py-2 hover:bg-base-200 cursor-pointer select-none w-full text-left"
          style={{ 'padding-left': paddingLeft }}
          onClick={() => setIsExpanded(!isExpanded())}
        >
          <span class="text-base-content/60 text-sm">{isExpanded() ? '▼' : '▶'}</span>
          <span class="font-medium">{props.group.name}/</span>
          <span class="text-sm text-base-content/60">({entryCount()})</span>
        </button>
      </Show>

      <Show when={isExpanded()}>
        {/* Child groups */}
        <For each={props.group.children}>
          {(childGroup) => <GroupItem group={childGroup} scope={props.scope} level={props.level + 1} />}
        </For>

        {/* Entries in this group */}
        <For each={props.group.entries}>
          {(entry) => (
            <div
              class="group flex items-center gap-2 px-4 py-2 hover:bg-base-200 w-full"
              style={{ 'padding-left': `${(props.level + 1) * 1.5}rem` }}
            >
              <button
                type="button"
                class="flex-1 flex items-center gap-4 text-left cursor-pointer"
                onClick={() => selectEntry(entry)}
              >
                <div class="flex-1">
                  <span class="font-medium">{entry.key.split('/').pop()}</span>
                  <span class={`ml-2 badge badge-sm ${getEntryScopeInfo(entry).badgeClass}`}>
                    {getEntryScopeInfo(entry).display}
                  </span>
                  <Show when={showAllVersions()}>
                    <span class="ml-2 text-sm text-base-content/60">v{entry.version || 1}</span>
                  </Show>
                  <Show when={entry.description}>
                    <span class="ml-3 text-sm text-base-content/60">{entry.description}</span>
                  </Show>
                </div>
                <div class="text-sm text-base-content/60">{formatDate(entry.createdAt || entry.created_at || '')}</div>
              </button>
              <div class="dropdown dropdown-end">
                <button
                  type="button"
                  tabindex="0"
                  class="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-4 h-4"
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
            </div>
          )}
        </For>
      </Show>

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
    </Show>
  )
}

export default function GroupedEntryView(props: GroupedEntryViewProps) {
  // Filter and group entries
  const groupedEntries = createMemo(() => {
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

    // Group entries by path
    return groupEntriesByPath(entries)
  })

  return (
    <div class="h-full overflow-y-auto">
      <Show
        when={groupedEntries().entries.length > 0 || groupedEntries().children.length > 0}
        fallback={<div class="text-center text-base-content/60 py-8">No entries found</div>}
      >
        <GroupItem group={groupedEntries()} scope={props.scope} level={0} />
      </Show>
    </div>
  )
}
