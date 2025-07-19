import { createMemo, createSignal, For, Show } from 'solid-js'
import type { VaultEntry } from '../lib/api'
import { countEntriesInGroup, type EntryGroup, groupEntriesByPath } from '../lib/grouping'
import { searchQuery, setViewMode, showAllVersions } from '../stores/ui'
import { setSelectedEntry } from '../stores/vault'

interface GroupedEntryViewProps {
  entries: VaultEntry[]
  scope: string
}

interface GroupItemProps {
  group: EntryGroup
  scope: string
  level: number
}

function GroupItem(props: GroupItemProps) {
  const [isExpanded, setIsExpanded] = createSignal(true)

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
            <button
              type="button"
              class="group flex items-center gap-4 px-4 py-2 hover:bg-base-200 cursor-pointer w-full text-left"
              style={{ 'padding-left': `${(props.level + 1) * 1.5}rem` }}
              onClick={() => selectEntry(entry)}
            >
              <div class="flex-1">
                <span class="font-medium">{entry.key.split('/').pop()}</span>
                <Show when={showAllVersions()}>
                  <span class="ml-2 text-sm text-base-content/60">v{entry.version || 1}</span>
                </Show>
                <Show when={entry.description}>
                  <span class="ml-3 text-sm text-base-content/60">{entry.description}</span>
                </Show>
              </div>
              <div class="text-sm text-base-content/60">{formatDate(entry.createdAt || entry.created_at || '')}</div>
            </button>
          )}
        </For>
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
