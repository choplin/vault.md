import { describe, expect, it } from 'vitest'
import { countEntriesInGroup, flattenGroup, groupEntriesByPath } from '../src/web/lib/grouping.js'
import type { VaultEntry } from '../src/web/lib/api.js'

describe('grouping functions', () => {
  const createEntry = (key: string): VaultEntry => ({
    id: Math.random(),
    scopeId: 1,
    scope: 'test',
    version: 1,
    key,
    filePath: `/path/to/${key}`,
    hash: 'hash',
    description: `Description for ${key}`,
    createdAt: new Date().toISOString(),
  })

  describe('groupEntriesByPath', () => {
    it('should group entries by path', () => {
      const entries = [
        createEntry('feat/foo'),
        createEntry('feat/bar'),
        createEntry('fix/bug1'),
        createEntry('fix/bug2'),
        createEntry('standalone'),
      ]

      const result = groupEntriesByPath(entries)

      // Root should have 1 standalone entry and 2 child groups
      expect(result.entries).toHaveLength(1)
      expect(result.entries[0].key).toBe('standalone')
      expect(result.children).toHaveLength(2)

      // Check feat group
      const featGroup = result.children.find((g) => g.name === 'feat')
      expect(featGroup).toBeDefined()
      expect(featGroup!.entries).toHaveLength(2)
      expect(featGroup!.entries.map((e) => e.key)).toContain('feat/foo')
      expect(featGroup!.entries.map((e) => e.key)).toContain('feat/bar')

      // Check fix group
      const fixGroup = result.children.find((g) => g.name === 'fix')
      expect(fixGroup).toBeDefined()
      expect(fixGroup!.entries).toHaveLength(2)
      expect(fixGroup!.entries.map((e) => e.key)).toContain('fix/bug1')
      expect(fixGroup!.entries.map((e) => e.key)).toContain('fix/bug2')
    })

    it('should handle nested paths', () => {
      const entries = [
        createEntry('api/v1/users'),
        createEntry('api/v1/posts'),
        createEntry('api/v2/users'),
        createEntry('api/auth'),
      ]

      const result = groupEntriesByPath(entries)

      // Root should have api group
      expect(result.children).toHaveLength(1)
      expect(result.children[0].name).toBe('api')

      const apiGroup = result.children[0]
      expect(apiGroup.entries).toHaveLength(1)
      expect(apiGroup.entries[0].key).toBe('api/auth')
      expect(apiGroup.children).toHaveLength(2)

      // Check v1 group
      const v1Group = apiGroup.children.find((g) => g.name === 'v1')
      expect(v1Group).toBeDefined()
      expect(v1Group!.entries).toHaveLength(2)

      // Check v2 group
      const v2Group = apiGroup.children.find((g) => g.name === 'v2')
      expect(v2Group).toBeDefined()
      expect(v2Group!.entries).toHaveLength(1)
    })

    it('should sort groups and entries', () => {
      const entries = [
        createEntry('z/file'),
        createEntry('a/file'),
        createEntry('m/file'),
        createEntry('a/z'),
        createEntry('a/a'),
      ]

      const result = groupEntriesByPath(entries)

      // Groups should be sorted alphabetically
      expect(result.children.map((g) => g.name)).toEqual(['a', 'm', 'z'])

      // Entries within groups should be sorted
      const aGroup = result.children.find((g) => g.name === 'a')
      expect(aGroup!.entries.map((e) => e.key)).toEqual(['a/a', 'a/file', 'a/z'])
    })
  })

  describe('countEntriesInGroup', () => {
    it('should count all entries including nested ones', () => {
      const entries = [
        createEntry('feat/foo'),
        createEntry('feat/bar'),
        createEntry('feat/nested/baz'),
        createEntry('fix/bug'),
      ]

      const grouped = groupEntriesByPath(entries)
      expect(countEntriesInGroup(grouped)).toBe(4)

      const featGroup = grouped.children.find((g) => g.name === 'feat')
      expect(countEntriesInGroup(featGroup!)).toBe(3)
    })
  })

  describe('flattenGroup', () => {
    it('should flatten grouped structure back to entries', () => {
      const entries = [
        createEntry('feat/foo'),
        createEntry('feat/bar'),
        createEntry('fix/bug'),
        createEntry('standalone'),
      ]

      const grouped = groupEntriesByPath(entries)
      const flattened = flattenGroup(grouped)

      expect(flattened).toHaveLength(4)
      expect(flattened.map((e) => e.key).sort()).toEqual([
        'feat/bar',
        'feat/foo',
        'fix/bug',
        'standalone',
      ])
    })
  })
})
