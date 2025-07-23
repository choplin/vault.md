import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, rmSync } from 'node:fs'
import { spawn, execSync } from 'node:child_process'

describe('CLI delete command', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(() => {
    // Create test directory
    testDir = join(tmpdir(), `vault-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    originalCwd = process.cwd()
    process.chdir(testDir)

    // Initialize git repository
    execSync('git init', { cwd: testDir })
    execSync('git config user.email "test@example.com"', { cwd: testDir })
    execSync('git config user.name "Test User"', { cwd: testDir })
    execSync('git add .', { cwd: testDir })
    execSync('git commit -m "Initial commit" --allow-empty', { cwd: testDir })
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(testDir, { recursive: true, force: true })
    vi.clearAllMocks()
  })

  const runCommand = async (args: string[], input?: string): Promise<{ stdout: string; stderr: string }> => {
    const cliPath = join(originalCwd, 'dist', 'cli.js')
    return new Promise((resolve, reject) => {
      const proc = spawn('node', [cliPath, ...args], {
        cwd: testDir,
        env: { ...process.env, NODE_ENV: 'test' },
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      if (input) {
        proc.stdin.write(input)
        proc.stdin.end()
      }

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr })
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`))
        }
      })

      proc.on('error', reject)
    })
  }

  describe('scope options for key deletion', () => {
    beforeEach(async () => {
      // Set up test entries in different scopes
      await runCommand(['set', 'test-key', '--scope', 'global'], 'global content')
      await runCommand(['set', 'test-key', '--scope', 'repository'], 'repository content')
      await runCommand(['set', 'test-key', '--scope', 'branch'], 'branch content')
    })

    it('should delete entry from global scope when --scope global', async () => {
      // Delete from global scope
      const { stdout } = await runCommand(['delete', 'test-key', '--scope', 'global', '--force'])
      expect(stdout).toContain('Deleted')
      expect(stdout).toContain('test-key')

      // Verify it's deleted from global but not from other scopes
      await expect(
        runCommand(['get', 'test-key', '--scope', 'global'])
      ).rejects.toThrow('Key not found')

      // Should still exist in repository scope
      const repoCheck = await runCommand(['get', 'test-key', '--scope', 'repository'])
      expect(repoCheck.stdout).toContain('.local/share/vault.md')
    })

    it('should delete entry from repository scope when --scope repository', async () => {
      const { stdout } = await runCommand(['delete', 'test-key', '--scope', 'repository', '--force'])
      expect(stdout).toContain('Deleted')
      expect(stdout).toContain('test-key')

      // Verify it's deleted from repository but not from other scopes
      await expect(
        runCommand(['get', 'test-key', '--scope', 'repository'])
      ).rejects.toThrow('Key not found')

      // Should still exist in global scope
      const globalCheck = await runCommand(['get', 'test-key', '--scope', 'global'])
      expect(globalCheck.stdout).toContain('global')
    })

    it('should delete entry from branch scope when --scope branch', async () => {
      const { stdout } = await runCommand(['delete', 'test-key', '--scope', 'branch', '--force'])
      expect(stdout).toContain('Deleted')
      expect(stdout).toContain('test-key')

      // Verify it's deleted from branch but not from other scopes
      await expect(
        runCommand(['get', 'test-key', '--scope', 'branch'])
      ).rejects.toThrow('Key not found')

      // Should still exist in repository scope
      const repoCheck = await runCommand(['get', 'test-key', '--scope', 'repository'])
      expect(repoCheck.stdout).toContain('.local/share/vault.md')
    })

    it('should reject invalid scope values', async () => {
      await expect(
        runCommand(['delete', 'test-key', '--scope', 'invalid', '--force'])
      ).rejects.toThrow()
    })

    it('should use repository scope by default when no scope specified', async () => {
      const { stdout } = await runCommand(['delete', 'test-key', '--force'])
      expect(stdout).toContain('Deleted')

      // Verify repository scope was deleted
      await expect(
        runCommand(['get', 'test-key', '--scope', 'repository'])
      ).rejects.toThrow('Key not found')

      // Global scope should still exist
      const globalCheck = await runCommand(['get', 'test-key', '--scope', 'global'])
      expect(globalCheck.stdout).toContain('global')
    })
  })

  describe('version deletion', () => {
    it('should delete specific version when --ver is specified', async () => {
      // Create multiple versions
      await runCommand(['set', 'versioned-key'], 'version 1')
      await runCommand(['set', 'versioned-key'], 'version 2')
      await runCommand(['set', 'versioned-key'], 'version 3')

      // Delete version 2
      const { stdout } = await runCommand(['delete', 'versioned-key', '--ver', '2', '--force'])
      expect(stdout).toContain('Deleted version 2')

      // Verify version 2 is gone but others remain
      await expect(
        runCommand(['get', 'versioned-key', '--ver', '2'])
      ).rejects.toThrow()

      // Version 1 should still exist
      const v1Check = await runCommand(['get', 'versioned-key', '--ver', '1'])
      expect(v1Check.stdout).toContain('_v1.txt')

      // Version 3 should still exist (and be the latest)
      const v3Check = await runCommand(['get', 'versioned-key'])
      expect(v3Check.stdout).toContain('_v3.txt')
    })
  })

  describe('scope with custom paths', () => {
    it('should delete from custom repository when --repo is specified', async () => {
      const customRepo = '/custom/repo/path'
      await runCommand(['set', 'custom-key', '--scope', 'repository', '--repo', customRepo], 'custom content')

      const { stdout } = await runCommand(['delete', 'custom-key', '--scope', 'repository', '--repo', customRepo, '--force'])
      expect(stdout).toContain('Deleted')
    })

    it('should delete from custom branch when --repo and --branch are specified', async () => {
      const customRepo = '/custom/repo/path'
      const customBranch = 'feature/test'
      await runCommand(
        ['set', 'custom-key', '--scope', 'branch', '--repo', customRepo, '--branch', customBranch],
        'custom content'
      )

      const { stdout } = await runCommand(
        ['delete', 'custom-key', '--scope', 'branch', '--repo', customRepo, '--branch', customBranch, '--force']
      )
      expect(stdout).toContain('Deleted')
    })

    it('should ignore --repo option when scope is global', async () => {
      await runCommand(['set', 'global-key', '--scope', 'global'], 'global content')

      const { stdout } = await runCommand(['delete', 'global-key', '--scope', 'global', '--repo', '/ignored/path', '--force'])
      expect(stdout).toContain('Deleted')
    })
  })

  describe('error handling', () => {
    it('should show error when key not found', async () => {
      await expect(
        runCommand(['delete', 'non-existent-key', '--force'])
      ).rejects.toThrow('Key \'non-existent-key\' not found')
    })

    it('should show error when --branch used without branch scope', async () => {
      await expect(
        runCommand(['delete', 'test-key', '--scope', 'repository', '--branch', 'main', '--force'])
      ).rejects.toThrow()
    })

    it('should show error when --branch used with global scope', async () => {
      await expect(
        runCommand(['delete', 'test-key', '--scope', 'global', '--branch', 'main', '--force'])
      ).rejects.toThrow()
    })
  })

  describe('confirmation prompts', () => {
    it('should prompt for confirmation when --force not provided', async () => {
      await runCommand(['set', 'prompt-key'], 'test content')

      // Simulate user typing 'n' for no
      const { stdout } = await runCommand(['delete', 'prompt-key'], 'n\n')
      expect(stdout).toContain('Deletion cancelled')

      // Verify key still exists
      const check = await runCommand(['get', 'prompt-key'])
      expect(check.stdout).toContain('.local/share/vault.md')
    })

    it('should delete when user confirms with y', async () => {
      await runCommand(['set', 'prompt-key'], 'test content')

      // Simulate user typing 'y' for yes
      const { stdout } = await runCommand(['delete', 'prompt-key'], 'y\n')
      expect(stdout).toContain('Deleted')

      // Verify key is deleted
      await expect(
        runCommand(['get', 'prompt-key'])
      ).rejects.toThrow('Key not found')
    })
  })

  describe('scope deletion options', () => {
    beforeEach(async () => {
      // Create some test data
      await runCommand(['set', 'scope-test-key'], 'test content')
    })

    it('should delete current scope when --current-scope is used', async () => {
      const { stdout } = await runCommand(['delete', '--current-scope', '--force'])
      expect(stdout).toContain('Deleted scope')
      expect(stdout).toContain('entries')

      // Verify all keys in current scope are gone
      await expect(
        runCommand(['get', 'scope-test-key'])
      ).rejects.toThrow()
    })

    it('should delete specific branch when --delete-branch is used', async () => {
      // Create data in a different branch
      execSync('git checkout -b test-branch', { cwd: testDir })
      await runCommand(['set', 'branch-key', '--scope', 'branch'], 'branch content')

      // Switch back to main branch
      execSync('git checkout main', { cwd: testDir })

      const { stdout } = await runCommand(['delete', '--delete-branch', 'test-branch', '--force'])
      expect(stdout).toContain('Deleted vault for branch')
    })

    it('should delete all branches when --all-branches is used', async () => {
      const { stdout } = await runCommand(['delete', '--all-branches', '--force'])
      expect(stdout).toContain('Deleted entire vault')
      expect(stdout).toContain('total entries')
    })
  })
})
