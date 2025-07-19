import type { VaultEntry } from './api'

export interface EntryGroup {
  name: string
  path: string
  children: EntryGroup[]
  entries: VaultEntry[]
}

/**
 * Group vault entries by their key paths using slash as delimiter
 */
export function groupEntriesByPath(entries: VaultEntry[]): EntryGroup {
  const root: EntryGroup = {
    name: '',
    path: '',
    children: [],
    entries: [],
  }

  // Process each entry
  entries.forEach((entry) => {
    const parts = entry.key.split('/')
    let currentGroup = root

    // Navigate/create the group hierarchy
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        // This is the final part - add entry to current group
        currentGroup.entries.push(entry)
      } else {
        // This is a group - find or create it
        let childGroup = currentGroup.children.find((g) => g.name === part)
        if (!childGroup) {
          childGroup = {
            name: part,
            path: parts.slice(0, index + 1).join('/'),
            children: [],
            entries: [],
          }
          currentGroup.children.push(childGroup)
        }
        currentGroup = childGroup
      }
    })
  })

  // Sort groups and entries
  sortGroupRecursively(root)

  return root
}

/**
 * Sort groups and entries recursively
 */
function sortGroupRecursively(group: EntryGroup): void {
  // Sort child groups by name
  group.children.sort((a, b) => a.name.localeCompare(b.name))

  // Sort entries by key
  group.entries.sort((a, b) => a.key.localeCompare(b.key))

  // Recursively sort children
  group.children.forEach(sortGroupRecursively)
}

/**
 * Count total entries in a group (including all descendants)
 */
export function countEntriesInGroup(group: EntryGroup): number {
  let count = group.entries.length
  group.children.forEach((child) => {
    count += countEntriesInGroup(child)
  })
  return count
}

/**
 * Flatten a group structure back to a list of entries
 */
export function flattenGroup(group: EntryGroup): VaultEntry[] {
  const entries: VaultEntry[] = [...group.entries]
  group.children.forEach((child) => {
    entries.push(...flattenGroup(child))
  })
  return entries
}
