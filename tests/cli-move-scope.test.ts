import { describe, it, expect, beforeEach, vi } from 'vitest'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('CLI move-scope command', () => {
  let tempDir: string
  let originalEnv: NodeJS.ProcessEnv
  let originalCwd: string

  beforeEach(() => {
    // Save original state
    originalEnv = { ...process.env }
    originalCwd = process.cwd()

    // Create temporary directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'))

    // Set up test environment
    process.env.VAULT_DIR = path.join(tempDir, '.vault')
    process.env.VAULT_DB_PATH = path.join(process.env.VAULT_DIR, 'vault.db')

    // Create vault directory
    fs.mkdirSync(process.env.VAULT_DIR, { recursive: true })
  })

  afterEach(() => {
    // Restore original state
    process.env = originalEnv
    process.chdir(originalCwd)

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  const runCLI = (args: string): string => {
    const cliPath = path.join(__dirname, '..', 'dist', 'cli.js')
    try {
      const result = execSync(`node ${cliPath} ${args}`, {
        encoding: 'utf8',
        env: process.env
      })
      return result.trim()
    } catch (error: any) {
      throw new Error(error.stderr || error.stdout || error.message)
    }
  }

  describe('Requirement 4: Data movement between scopes', () => {
    describe('Successful moves', () => {
      it('should move data from branch scope to repository scope', () => {
        // Create git repository
        process.chdir(tempDir)
        execSync('git init', { encoding: 'utf8' })
        execSync('git config user.email "test@example.com"', { encoding: 'utf8' })
        execSync('git config user.name "Test User"', { encoding: 'utf8' })

        // Create a test file and commit
        fs.writeFileSync('test.txt', 'test')
        execSync('git add .', { encoding: 'utf8' })
        execSync('git commit -m "Initial commit"', { encoding: 'utf8' })

        // Create feature branch
        execSync('git checkout -b feature-x', { encoding: 'utf8' })

        // Set data in branch scope
        fs.writeFileSync('value.txt', 'test-value')
        runCLI('set test-key --scope branch -d "Test value in branch" < value.txt')

        // Verify data exists in branch scope
        const beforeMove = runCLI('get test-key --scope branch')
        expect(beforeMove).toBe('test-value')

        // Move to repository scope
        const moveOutput = runCLI('move-scope test-key --from-scope branch --to-scope repository')
        expect(moveOutput).toContain('Moved test-key from')

        // Verify data no longer exists in branch scope
        expect(() => runCLI('get test-key --scope branch')).toThrow()

        // Verify data exists in repository scope
        const afterMove = runCLI('get test-key --scope repository')
        expect(afterMove).toBe('test-value')
      })

      it('should move data from repository scope to global scope', () => {
        process.chdir(tempDir)

        // Set data in repository scope (default)
        fs.writeFileSync('value.txt', 'repository-value')
        runCLI('set test-key -d "Test value in repository" < value.txt')

        // Verify data exists in repository scope
        const beforeMove = runCLI('get test-key')
        expect(beforeMove).toBe('repository-value')

        // Move to global scope
        const moveOutput = runCLI('move-scope test-key --from-scope repository --to-scope global')
        expect(moveOutput).toContain('Moved test-key from')

        // Verify data no longer exists in repository scope
        expect(() => runCLI('get test-key --scope repository')).toThrow()

        // Verify data exists in global scope
        const afterMove = runCLI('get test-key --scope global')
        expect(afterMove).toBe('repository-value')
      })

      it('should preserve version numbers when moving between scopes', () => {
        process.chdir(tempDir)

        // Set multiple versions in repository scope
        fs.writeFileSync('value1.txt', 'value-v1')
        runCLI('set test-key -d "Version 1" < value1.txt')

        fs.writeFileSync('value2.txt', 'value-v2')
        runCLI('set test-key -d "Version 2" < value2.txt')

        fs.writeFileSync('value3.txt', 'value-v3')
        runCLI('set test-key -d "Version 3" < value3.txt')

        // List versions before move
        const beforeList = runCLI('list --all-versions --json')
        const beforeData = JSON.parse(beforeList)
        const beforeVersions = beforeData.entries
          .filter((e: any) => e.key === 'test-key')
          .map((e: any) => e.version)
        expect(beforeVersions).toEqual([3, 2, 1])

        // Move to global scope
        runCLI('move-scope test-key --from-scope repository --to-scope global')

        // List versions after move
        const afterList = runCLI('list --scope global --all-versions --json')
        const afterData = JSON.parse(afterList)
        const afterVersions = afterData.entries
          .filter((e: any) => e.key === 'test-key')
          .map((e: any) => e.version)

        // Verify same version numbers
        expect(afterVersions).toEqual([3, 2, 1])

        // Verify content of each version
        expect(runCLI('get test-key --scope global --ver 1')).toBe('value-v1')
        expect(runCLI('get test-key --scope global --ver 2')).toBe('value-v2')
        expect(runCLI('get test-key --scope global --ver 3')).toBe('value-v3')
      })
    })

    describe('Error cases', () => {
      it('should error when key already exists in target scope', () => {
        process.chdir(tempDir)

        // Set same key in both scopes
        fs.writeFileSync('value.txt', 'repo-value')
        runCLI('set test-key --scope repository -d "Repository value" < value.txt')

        fs.writeFileSync('value2.txt', 'global-value')
        runCLI('set test-key --scope global -d "Global value" < value2.txt')

        // Try to move - should fail
        expect(() =>
          runCLI('move-scope test-key --from-scope repository --to-scope global')
        ).toThrow('Key already exists in target scope')
      })

      it('should error when key not found in source scope', () => {
        process.chdir(tempDir)

        // Try to move non-existent key
        expect(() =>
          runCLI('move-scope non-existent --from-scope repository --to-scope global')
        ).toThrow('Key not found in source scope')
      })

      it('should error when source and target scopes are the same', () => {
        process.chdir(tempDir)

        // Set data
        fs.writeFileSync('value.txt', 'test-value')
        runCLI('set test-key -d "Test value" < value.txt')

        // Try to move to same scope
        expect(() =>
          runCLI('move-scope test-key --from-scope repository --to-scope repository')
        ).toThrow('Source and target scopes must be different')
      })

      it('should error when specifying branch options with non-branch scope', () => {
        process.chdir(tempDir)

        // Try to use --from-branch with global scope
        expect(() =>
          runCLI('move-scope test-key --from-scope global --from-branch main --to-scope repository')
        ).toThrow('--from-branch option can only be used with --from-scope branch')

        // Try to use --to-branch with repository scope
        expect(() =>
          runCLI('move-scope test-key --from-scope global --to-scope repository --to-branch main')
        ).toThrow('--to-branch option can only be used with --to-scope branch')
      })
    })

    describe('Branch scope handling', () => {
      it('should move from specific branch to repository', () => {
        // Create git repository
        process.chdir(tempDir)
        execSync('git init', { encoding: 'utf8' })
        execSync('git config user.email "test@example.com"', { encoding: 'utf8' })
        execSync('git config user.name "Test User"', { encoding: 'utf8' })

        // Create initial commit
        fs.writeFileSync('test.txt', 'test')
        execSync('git add .', { encoding: 'utf8' })
        execSync('git commit -m "Initial commit"', { encoding: 'utf8' })

        // Create and switch to feature branch
        execSync('git checkout -b feature-branch', { encoding: 'utf8' })

        // Set data in feature branch
        fs.writeFileSync('value.txt', 'feature-value')
        runCLI('set branch-test-key --scope branch -d "Feature branch value" < value.txt')

        // Switch back to main
        execSync('git checkout main', { encoding: 'utf8' })

        // Move from feature branch to repository (while on main)
        const moveOutput = runCLI('move-scope branch-test-key --from-scope branch --from-branch feature-branch --to-scope repository')
        expect(moveOutput).toContain('feature-branch')

        // Verify data exists in repository scope
        const result = runCLI('get branch-test-key --scope repository')
        expect(result).toBe('feature-value')
      })

      it('should move from repository to specific branch', () => {
        // Create git repository
        process.chdir(tempDir)
        execSync('git init', { encoding: 'utf8' })
        execSync('git config user.email "test@example.com"', { encoding: 'utf8' })
        execSync('git config user.name "Test User"', { encoding: 'utf8' })

        // Create initial commit
        fs.writeFileSync('test.txt', 'test')
        execSync('git add .', { encoding: 'utf8' })
        execSync('git commit -m "Initial commit"', { encoding: 'utf8' })

        // Set data in repository scope
        fs.writeFileSync('value.txt', 'repo-value')
        runCLI('set test-key -d "Repository value" < value.txt')

        // Create target branch
        execSync('git checkout -b target-branch', { encoding: 'utf8' })

        // Move to target branch (explicit)
        const moveOutput = runCLI('move-scope test-key --from-scope repository --to-scope branch --to-branch target-branch')
        expect(moveOutput).toContain('target-branch')

        // Verify data exists in branch scope
        const result = runCLI('get test-key --scope branch')
        expect(result).toBe('repo-value')
      })
    })
  })
})
