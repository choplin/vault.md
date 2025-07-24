import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, execSync } from 'node:child_process'

describe('CLI get command', () => {
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

  describe('scope options', () => {
    beforeEach(async () => {
      // Set up test entries in different scopes
      await runCommand(['set', 'test-key', '--scope', 'global'], 'global content')
      await runCommand(['set', 'test-key', '--scope', 'repository'], 'repository content')
      await runCommand(['set', 'test-key', '--scope', 'branch'], 'branch content')
    })

    it('should get entry from global scope when --scope global', async () => {
      const { stdout } = await runCommand(['get', 'test-key', '--scope', 'global'])
      expect(stdout).toBe('global content')
    })

    it('should get entry from repository scope when --scope repository', async () => {
      const { stdout } = await runCommand(['get', 'test-key', '--scope', 'repository'])
      expect(stdout).toBe('repository content')
    })

    it('should get entry from branch scope when --scope branch', async () => {
      const { stdout } = await runCommand(['get', 'test-key', '--scope', 'branch'])
      expect(stdout).toBe('branch content')
    })

    it('should reject invalid scope values', async () => {
      await expect(
        runCommand(['get', 'test-key', '--scope', 'invalid'])
      ).rejects.toThrow()
    })

    it('should use repository scope by default when no scope specified', async () => {
      const { stdout } = await runCommand(['get', 'test-key'])
      expect(stdout).toBe('repository content')
    })
  })

  describe('all-scopes option', () => {
    it('should search all scopes in order when --all-scopes is specified', async () => {
      // Set only in global scope
      await runCommand(['set', 'global-only-key', '--scope', 'global'], 'global only content')

      // Get with all-scopes should find it
      const { stdout } = await runCommand(['get', 'global-only-key', '--all-scopes'])
      expect(stdout).toBe('global only content')
    })

    it('should return branch scope entry first when --all-scopes and entry exists in multiple scopes', async () => {
      // Set in all scopes
      await runCommand(['set', 'multi-scope-key', '--scope', 'global'], 'global content')
      await runCommand(['set', 'multi-scope-key', '--scope', 'repository'], 'repository content')
      await runCommand(['set', 'multi-scope-key', '--scope', 'branch'], 'branch content')

      // Get with all-scopes should return branch scope (highest priority)
      // Note: When using --all-scopes without specifying scope, it searches from the current default scope
      const { stdout } = await runCommand(['get', 'multi-scope-key', '--all-scopes', '--scope', 'branch'])
      expect(stdout).toBe('branch content')
    })

    it('should fallback to repository scope when not in branch scope', async () => {
      // Set only in repository and global
      await runCommand(['set', 'repo-global-key', '--scope', 'global'], 'global content')
      await runCommand(['set', 'repo-global-key', '--scope', 'repository'], 'repository content')

      // Get with all-scopes should return repository scope
      const { stdout } = await runCommand(['get', 'repo-global-key', '--all-scopes'])
      expect(stdout).toBe('repository content')
    })
  })

  describe('scope with custom paths', () => {
    it('should accept --scope repository with --repo option', async () => {
      const customRepo = '/custom/repo/path'
      await runCommand(['set', 'custom-key', '--scope', 'repository', '--repo', customRepo], 'custom content')

      const { stdout } = await runCommand(['get', 'custom-key', '--scope', 'repository', '--repo', customRepo])
      expect(stdout).toBe('custom content')
    })

    it('should accept --scope branch with --repo and --branch options', async () => {
      const customRepo = '/custom/repo/path'
      const customBranch = 'feature/test'
      await runCommand(
        ['set', 'custom-key', '--scope', 'branch', '--repo', customRepo, '--branch', customBranch],
        'custom content'
      )

      const { stdout } = await runCommand(
        ['get', 'custom-key', '--scope', 'branch', '--repo', customRepo, '--branch', customBranch]
      )
      expect(stdout).toBe('custom content')
    })

    it('should ignore --repo option when scope is global', async () => {
      await runCommand(['set', 'global-key', '--scope', 'global'], 'global content')

      const { stdout } = await runCommand(
        ['get', 'global-key', '--scope', 'global', '--repo', '/ignored/path']
      )
      expect(stdout).toBe('global content')
    })
  })

  describe('error handling', () => {
    it('should show error when key not found', async () => {
      await expect(
        runCommand(['get', 'non-existent-key'])
      ).rejects.toThrow('Key not found')
    })

    it('should show error when --branch used without branch scope', async () => {
      await expect(
        runCommand(['get', 'test-key', '--scope', 'repository', '--branch', 'main'])
      ).rejects.toThrow()
    })

    it('should show error when --branch used with global scope', async () => {
      await expect(
        runCommand(['get', 'test-key', '--scope', 'global', '--branch', 'main'])
      ).rejects.toThrow()
    })
  })

  describe('version option', () => {
    it('should get specific version when --version is specified', async () => {
      // Create multiple versions
      await runCommand(['set', 'versioned-key'], 'version 1')
      await runCommand(['set', 'versioned-key'], 'version 2')

      // Get latest version (should be v2)
      const latestContent = await runCommand(['get', 'versioned-key'])
      expect(latestContent.stdout).toBe('version 2')

      // Get version 1
      const v1Content = await runCommand(['get', 'versioned-key', '--ver', '1'])
      expect(v1Content.stdout).toBe('version 1')
    })
  })
})
