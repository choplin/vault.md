import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, rmSync } from 'node:fs'
import { spawn, execSync } from 'node:child_process'

describe('CLI list command', () => {
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
      await runCommand(['set', 'global-key', '--scope', 'global', '-d', 'Global entry'], 'global content')
      await runCommand(['set', 'repo-key', '--scope', 'repository', '-d', 'Repository entry'], 'repository content')
      await runCommand(['set', 'branch-key', '--scope', 'branch', '-d', 'Branch entry'], 'branch content')
    })

    it('should list entries from global scope when --scope global', async () => {
      const { stdout } = await runCommand(['list', '--scope', 'global'])
      expect(stdout).toContain('global-key')
      expect(stdout).toContain('Global entry')
      expect(stdout).not.toContain('repo-key')
      expect(stdout).not.toContain('branch-key')
    })

    it('should list entries from repository scope when --scope repository', async () => {
      const { stdout } = await runCommand(['list', '--scope', 'repository'])
      expect(stdout).toContain('repo-key')
      expect(stdout).toContain('Repository entry')
      expect(stdout).not.toContain('global-key')
      expect(stdout).not.toContain('branch-key')
    })

    it('should list entries from branch scope when --scope branch', async () => {
      const { stdout } = await runCommand(['list', '--scope', 'branch'])
      expect(stdout).toContain('branch-key')
      expect(stdout).toContain('Branch entry')
      expect(stdout).not.toContain('global-key')
      expect(stdout).not.toContain('repo-key')
    })

    it('should reject invalid scope values', async () => {
      await expect(
        runCommand(['list', '--scope', 'invalid'])
      ).rejects.toThrow()
    })

    it('should use repository scope by default when no scope specified', async () => {
      const { stdout } = await runCommand(['list'])
      expect(stdout).toContain('repo-key')
      expect(stdout).toContain('Repository entry')
      expect(stdout).not.toContain('global-key')
      expect(stdout).not.toContain('branch-key')
    })
  })

  describe('all-versions option', () => {
    it('should show all versions when --all-versions is specified', async () => {
      // Create multiple versions
      await runCommand(['set', 'multi-version-key'], 'version 1')
      await runCommand(['set', 'multi-version-key'], 'version 2')
      await runCommand(['set', 'multi-version-key'], 'version 3')

      // List without all-versions should show only latest
      const withoutAllVersions = await runCommand(['list'])
      const matches = withoutAllVersions.stdout.match(/multi-version-key/g)
      expect(matches).toHaveLength(1)
      expect(withoutAllVersions.stdout).toContain('v3')

      // List with all-versions should show all
      const withAllVersions = await runCommand(['list', '--all-versions'])
      const allMatches = withAllVersions.stdout.match(/multi-version-key/g)
      expect(allMatches).toHaveLength(3)
      expect(withAllVersions.stdout).toContain('v1')
      expect(withAllVersions.stdout).toContain('v2')
      expect(withAllVersions.stdout).toContain('v3')
    })
  })

  describe('json output', () => {
    it('should output as JSON when --json is specified', async () => {
      await runCommand(['set', 'json-test-key', '-d', 'Test description'], 'test content')

      const { stdout } = await runCommand(['list', '--json'])
      const data = JSON.parse(stdout)
      const entries = data.entries

      expect(Array.isArray(entries)).toBe(true)
      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({
        key: 'json-test-key',
        version: 1,
        description: 'Test description'
      })
      expect(entries[0]).toHaveProperty('createdAt')
      expect(entries[0]).toHaveProperty('scopeId')
    })
  })

  describe('scope with custom paths', () => {
    it('should list from custom repository when --repo is specified', async () => {
      const customRepo = '/custom/repo/path'
      await runCommand(['set', 'custom-repo-key', '--scope', 'repository', '--repo', customRepo], 'custom content')

      const { stdout } = await runCommand(['list', '--scope', 'repository', '--repo', customRepo])
      expect(stdout).toContain('custom-repo-key')
    })

    it('should list from custom branch when --repo and --branch are specified', async () => {
      const customRepo = '/custom/repo/path'
      const customBranch = 'feature/test'
      await runCommand(
        ['set', 'custom-branch-key', '--scope', 'branch', '--repo', customRepo, '--branch', customBranch],
        'custom content'
      )

      const { stdout } = await runCommand(
        ['list', '--scope', 'branch', '--repo', customRepo, '--branch', customBranch]
      )
      expect(stdout).toContain('custom-branch-key')
    })

    it('should ignore --repo option when scope is global', async () => {
      await runCommand(['set', 'global-key', '--scope', 'global'], 'global content')

      const { stdout } = await runCommand(['list', '--scope', 'global', '--repo', '/ignored/path'])
      expect(stdout).toContain('global-key')
    })
  })

  describe('error handling', () => {
    it('should show empty message when no entries found', async () => {
      const { stdout } = await runCommand(['list'])
      expect(stdout).toContain('No entries found')
    })

    it('should show error when --branch used without branch scope', async () => {
      await expect(
        runCommand(['list', '--scope', 'repository', '--branch', 'main'])
      ).rejects.toThrow()
    })

    it('should show error when --branch used with global scope', async () => {
      await expect(
        runCommand(['list', '--scope', 'global', '--branch', 'main'])
      ).rejects.toThrow()
    })
  })

  describe('empty scopes', () => {
    it('should handle empty repository scope gracefully', async () => {
      const { stdout } = await runCommand(['list', '--scope', 'repository'])
      expect(stdout).toContain('No entries found')
    })

    it('should handle empty branch scope gracefully', async () => {
      const { stdout } = await runCommand(['list', '--scope', 'branch'])
      expect(stdout).toContain('No entries found')
    })
  })
})
