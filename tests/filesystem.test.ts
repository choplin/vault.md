import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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
})
