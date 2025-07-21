import { describe, it, expect } from 'vitest'
import type { VaultOptions, ListOptions, SetOptions } from '../src/core/types'

describe('VaultOptions', () => {
  it('should support scope type property', () => {
    // Red: This test will fail because 'scope' property doesn't exist yet
    const options: VaultOptions = {
      scope: 'global'
    }

    expect(options.scope).toBe('global')
  })

  it('should accept repository scope type', () => {
    const options: VaultOptions = {
      scope: 'repository'
    }

    expect(options.scope).toBe('repository')
  })

  it('should accept branch scope type', () => {
    const options: VaultOptions = {
      scope: 'branch',
      branch: 'feature-x'
    }

    expect(options.scope).toBe('branch')
    expect(options.branch).toBe('feature-x')
  })

  it('should support allScopes option for search', () => {
    // Red: This test will fail because 'allScopes' property doesn't exist yet
    const options: VaultOptions = {
      allScopes: true
    }

    expect(options.allScopes).toBe(true)
  })
})

describe('ListOptions', () => {
  it('should extend VaultOptions with scope support', () => {
    const options: ListOptions = {
      scope: 'global',
      allVersions: true,
      json: false
    }

    expect(options.scope).toBe('global')
    expect(options.allVersions).toBe(true)
    expect(options.json).toBe(false)
  })
})

describe('SetOptions', () => {
  it('should extend VaultOptions with scope support', () => {
    const options: SetOptions = {
      scope: 'repository',
      description: 'Test entry'
    }

    expect(options.scope).toBe('repository')
    expect(options.description).toBe('Test entry')
  })
})
