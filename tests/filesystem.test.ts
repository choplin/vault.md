import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// Set up isolated test directory before importing modules
const testDir = mkdtempSync(join(tmpdir(), 'vault-fs-test-'))
process.env.VAULT_DIR = testDir

import {
  calculateHash,
  deleteFile,
  fileExists,
  readFile,
  saveFile,
  verifyFile,
} from '../src/core/filesystem.js'

describe('filesystem functions', () => {
  let tempDir: string
  let testDir: string

  beforeAll(() => {
    // Set up isolated test directory before tests
    testDir = mkdtempSync(join(tmpdir(), 'vault-fs-test-'))
    process.env.VAULT_DIR = testDir
  })

  beforeEach(() => {
    // Create temporary directory for testing
    tempDir = mkdtempSync(join(tmpdir(), 'vault-test-'))
  })

  afterEach(() => {
    // Clean up
    rmSync(tempDir, { recursive: true, force: true })
  })

  afterAll(() => {
    // Clean up test directory and reset environment
    rmSync(testDir, { recursive: true, force: true })
    delete process.env.VAULT_DIR
  })

  describe('calculateHash', () => {
    it('should calculate SHA-256 hash', () => {
      const content = 'Hello, World!'
      const hash = calculateHash(content)

      expect(hash).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f')
    })

    it('should return different hashes for different content', () => {
      const hash1 = calculateHash('content1')
      const hash2 = calculateHash('content2')

      expect(hash1).not.toBe(hash2)
    })

    it('should return same hash for same content', () => {
      const content = 'Same content'
      const hash1 = calculateHash(content)
      const hash2 = calculateHash(content)

      expect(hash1).toBe(hash2)
    })
  })

  describe('readFile', () => {
    it('should throw error for non-existent file', () => {
      expect(() => readFile('/non/existent/file.txt')).toThrow()
    })
  })

  describe('fileExists', () => {
    it('should return false for non-existent file', () => {
      expect(fileExists('/non/existent/file.txt')).toBe(false)
    })
  })

  describe('deleteFile', () => {
    it('should not throw error for non-existent file', () => {
      expect(() => deleteFile('/non/existent/file.txt')).not.toThrow()
    })
  })

  describe('key encoding', () => {
    it('should encode keys with special characters', () => {
      const content = 'Test content'

      // Test slash encoding
      const result1 = saveFile('test-project', 'feat/foo', 1, content)
      expect(result1.path).toContain('feat%2Ffoo_v1.txt')
      expect(readFile(result1.path)).toBe(content)

      // Test that different keys create different files
      const result2 = saveFile('test-project', 'feat-foo', 1, content)
      expect(result2.path).toContain('feat-foo_v1.txt')

      const result3 = saveFile('test-project', 'feat.foo', 1, content)
      expect(result3.path).toContain('feat.foo_v1.txt')

      // Ensure they are different files
      expect(result1.path).not.toBe(result2.path)
      expect(result1.path).not.toBe(result3.path)
      expect(result2.path).not.toBe(result3.path)
    })

    it('should handle complex keys with multiple special characters', () => {
      const content = 'Test content'
      const complexKey = 'api/v1/users.get?id=123'

      const result = saveFile('test-project', complexKey, 1, content)
      expect(result.path).toContain('api%2Fv1%2Fusers.get%3Fid%3D123_v1.txt')
      expect(readFile(result.path)).toBe(content)
    })

    it('should handle unicode characters in keys', () => {
      const content = 'Test content'
      const unicodeKey = 'こんにちは/世界'

      const result = saveFile('test-project', unicodeKey, 1, content)
      expect(result.path).toContain(encodeURIComponent(unicodeKey))
      expect(readFile(result.path)).toBe(content)
    })
  })
})
