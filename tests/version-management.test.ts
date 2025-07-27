import { describe, expect, it } from 'vitest'

// Mock version management logic
function getNextVersion(existingVersions: number[]): number {
  if (existingVersions.length === 0) {
    return 1
  }
  return Math.max(...existingVersions) + 1
}

function parseVersionFromFilename(filename: string): number | null {
  const match = filename.match(/_v(\d+)\.txt$/)
  return match ? parseInt(match[1], 10) : null
}

function formatVersionedFilename(key: string, version: number): string {
  return `${key}_v${version}.txt`
}

function findVersionsForKey(key: string, filenames: string[]): number[] {
  const versions: number[] = []
  const prefix = `${key}_v`

  for (const filename of filenames) {
    if (filename.startsWith(prefix)) {
      const version = parseVersionFromFilename(filename)
      if (version !== null) {
        versions.push(version)
      }
    }
  }

  return versions.sort((a, b) => a - b)
}

describe('Version Management', () => {
  describe('getNextVersion', () => {
    it('should return 1 for empty version list', () => {
      expect(getNextVersion([])).toBe(1)
    })

    it('should return next sequential version', () => {
      expect(getNextVersion([1, 2, 3])).toBe(4)
    })

    it('should handle non-sequential versions', () => {
      expect(getNextVersion([1, 3, 7])).toBe(8)
    })

    it('should handle single version', () => {
      expect(getNextVersion([5])).toBe(6)
    })
  })

  describe('parseVersionFromFilename', () => {
    it('should parse version from valid filename', () => {
      expect(parseVersionFromFilename('test-key_v1.txt')).toBe(1)
      expect(parseVersionFromFilename('test-key_v42.txt')).toBe(42)
      expect(parseVersionFromFilename('complex-key-name_v999.txt')).toBe(999)
    })

    it('should return null for invalid filenames', () => {
      expect(parseVersionFromFilename('test-key.txt')).toBeNull()
      expect(parseVersionFromFilename('test-key_v.txt')).toBeNull()
      expect(parseVersionFromFilename('test-key_vX.txt')).toBeNull()
      expect(parseVersionFromFilename('test-key_v1.json')).toBeNull()
    })

    it('should handle edge cases', () => {
      expect(parseVersionFromFilename('_v1.txt')).toBe(1)
      expect(parseVersionFromFilename('has_v_in_name_v2.txt')).toBe(2)
    })
  })

  describe('formatVersionedFilename', () => {
    it('should format filename correctly', () => {
      expect(formatVersionedFilename('test-key', 1)).toBe('test-key_v1.txt')
      expect(formatVersionedFilename('another-key', 42)).toBe('another-key_v42.txt')
    })

    it('should handle special characters in key', () => {
      expect(formatVersionedFilename('key-with-dash', 1)).toBe('key-with-dash_v1.txt')
      expect(formatVersionedFilename('key_with_underscore', 1)).toBe('key_with_underscore_v1.txt')
    })
  })

  describe('findVersionsForKey', () => {
    const filenames = [
      'test-key_v1.txt',
      'test-key_v2.txt',
      'test-key_v5.txt',
      'other-key_v1.txt',
      'test-key-different.txt',
      'test-key_invalid.txt',
      'prefix-test-key_v1.txt',
    ]

    it('should find all versions for a key', () => {
      expect(findVersionsForKey('test-key', filenames)).toEqual([1, 2, 5])
    })

    it('should return empty array for non-existent key', () => {
      expect(findVersionsForKey('non-existent', filenames)).toEqual([])
    })

    it('should not match partial key names', () => {
      expect(findVersionsForKey('key', filenames)).toEqual([])
    })

    it('should handle keys with similar names', () => {
      expect(findVersionsForKey('other-key', filenames)).toEqual([1])
    })

    it('should return sorted versions', () => {
      const unsortedFiles = [
        'key_v5.txt',
        'key_v1.txt',
        'key_v3.txt',
        'key_v2.txt',
      ]
      expect(findVersionsForKey('key', unsortedFiles)).toEqual([1, 2, 3, 5])
    })
  })
})
