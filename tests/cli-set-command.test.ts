import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, execSync } from 'node:child_process'
import { promisify } from 'node:util'

const execFile = promisify(spawn)

describe('CLI set command', () => {
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
    it('should accept --scope option with global value', async () => {
      const { stdout } = await runCommand(['set', 'test-key', '--scope', 'global'], 'test content')
      expect(stdout).toContain('.local/share/vault.md')
      expect(stdout).toContain('global')
    })

    it('should accept --scope option with repository value', async () => {
      const { stdout } = await runCommand(['set', 'test-key', '--scope', 'repository'], 'test content')
      expect(stdout).toContain('.local/share/vault.md')
      // The path is encoded in the output, so we need to check for the encoded version
      const encodedPath = testDir.replace(/\//g, '-')
      expect(stdout).toContain(encodedPath)
    })

    it('should accept --scope option with branch value', async () => {
      const { stdout } = await runCommand(['set', 'test-key', '--scope', 'branch'], 'test content')
      expect(stdout).toContain('.local/share/vault.md')
      const encodedPath = testDir.replace(/\//g, '-')
      expect(stdout).toContain(encodedPath)
      expect(stdout).toContain('main')
    })

    it('should reject invalid scope values', async () => {
      await expect(
        runCommand(['set', 'test-key', '--scope', 'invalid'], 'test content')
      ).rejects.toThrow()
    })

    it('should use repository scope by default when no scope specified', async () => {
      const { stdout } = await runCommand(['set', 'test-key'], 'test content')
      expect(stdout).toContain('.local/share/vault.md')
      const encodedPath = testDir.replace(/\//g, '-')
      expect(stdout).toContain(encodedPath)
      expect(stdout).not.toContain('main') // repository scope doesn't include branch
    })
  })

  describe('scope with custom paths', () => {
    it('should accept --scope repository with --repo option', async () => {
      const customRepo = '/custom/repo/path'
      const { stdout } = await runCommand(
        ['set', 'test-key', '--scope', 'repository', '--repo', customRepo],
        'test content'
      )
      expect(stdout).toContain('custom-repo-path')
    })

    it('should accept --scope branch with --repo and --branch options', async () => {
      const customRepo = '/custom/repo/path'
      const customBranch = 'feature/test'
      const { stdout } = await runCommand(
        ['set', 'test-key', '--scope', 'branch', '--repo', customRepo, '--branch', customBranch],
        'test content'
      )
      expect(stdout).toContain('custom-repo-path')
      expect(stdout).toContain('feature-test')
    })

    it('should ignore --repo option when scope is global', async () => {
      const { stdout } = await runCommand(
        ['set', 'test-key', '--scope', 'global', '--repo', '/ignored/path'],
        'test content'
      )
      expect(stdout).toContain('global')
      expect(stdout).not.toContain('ignored')
    })
  })


  describe('branch scope behavior', () => {
    it('should use current git branch when no --branch specified', async () => {
      // Create a new branch
      execSync('git checkout -b feature/test-branch', { cwd: testDir })

      const { stdout } = await runCommand(['set', 'test-key', '--scope', 'branch'], 'test content')
      expect(stdout).toContain('feature-test-branch')
    })

    it('should override current branch with --branch option', async () => {
      // Stay on main branch
      const { stdout } = await runCommand(
        ['set', 'test-key', '--scope', 'branch', '--branch', 'custom-branch'],
        'test content'
      )
      expect(stdout).toContain('custom-branch')
      expect(stdout).not.toContain('main')
    })
  })

  describe('file input with scope options', () => {
    it('should respect scope options when reading from file', async () => {
      // Create a test file
      const testFilePath = join(testDir, 'test-content.txt')
      writeFileSync(testFilePath, 'content from file')

      const { stdout } = await runCommand([
        'set', 'test-key', '-f', testFilePath, '--scope', 'global'
      ])
      expect(stdout).toContain('global')
    })

    it('should work with description and scope options together', async () => {
      const { stdout } = await runCommand([
        'set', 'test-key', '-d', 'test description', '--scope', 'repository'
      ], 'test content')

      // Verify it saved to repository scope
      const encodedPath = testDir.replace(/\//g, '-')
      expect(stdout).toContain(encodedPath)

      // TODO: Verify description was saved (would need to check via get --info)
    })
  })

  describe('edge cases', () => {
    it('should handle non-git directories with repository scope', async () => {
      // Remove .git directory
      rmSync(join(testDir, '.git'), { recursive: true, force: true })

      const { stdout } = await runCommand(['set', 'test-key', '--scope', 'repository'], 'test content')
      expect(stdout).toContain('.local/share/vault.md')
      expect(stdout).toContain(testDir.replace(/\//g, '-'))
    })

    it('should handle non-git directories with branch scope', async () => {
      // Remove .git directory
      rmSync(join(testDir, '.git'), { recursive: true, force: true })

      await expect(
        runCommand(['set', 'test-key', '--scope', 'branch'], 'test content')
      ).rejects.toThrow(/Not in a git repository/)
    })

    it('should handle branch scope with detached HEAD', async () => {
      // Create a commit and checkout by hash to create detached HEAD
      execSync('echo "test" > file.txt', { cwd: testDir })
      execSync('git add file.txt', { cwd: testDir })
      execSync('git commit -m "test commit"', { cwd: testDir })
      const commitHash = execSync('git rev-parse HEAD', { cwd: testDir }).toString().trim()
      execSync(`git checkout ${commitHash}`, { cwd: testDir })

      // In detached HEAD state, branch name becomes "HEAD"
      const { stdout } = await runCommand(['set', 'test-key', '--scope', 'branch'], 'test content')
      expect(stdout).toContain('HEAD')
    })
  })

  describe('cross-scope behavior', () => {
    it('should allow same key in different scopes', async () => {
      // Set in global scope
      const { stdout: globalOut } = await runCommand(
        ['set', 'shared-key', '--scope', 'global'],
        'global content'
      )
      expect(globalOut).toContain('global')

      // Set in repository scope
      const { stdout: repoOut } = await runCommand(
        ['set', 'shared-key', '--scope', 'repository'],
        'repository content'
      )
      expect(repoOut).toContain(testDir.replace(/\//g, '-'))
      expect(repoOut).not.toContain('global')

      // Set in branch scope
      const { stdout: branchOut } = await runCommand(
        ['set', 'shared-key', '--scope', 'branch'],
        'branch content'
      )
      expect(branchOut).toContain('main')

      // All three should have created different files
      expect(globalOut).not.toBe(repoOut)
      expect(repoOut).not.toBe(branchOut)
      expect(globalOut).not.toBe(branchOut)
    })

    it('should increment version within same scope', async () => {
      // Use unique key to avoid cross-test contamination
      const uniqueKey = `versioned-key-${Date.now()}`

      // First set
      const { stdout: v1 } = await runCommand(
        ['set', uniqueKey, '--scope', 'repository'],
        'version 1'
      )
      expect(v1).toContain('_v1.txt')

      // Second set - should be v2
      const { stdout: v2 } = await runCommand(
        ['set', uniqueKey, '--scope', 'repository'],
        'version 2'
      )
      expect(v2).toContain('_v2.txt')

      // Different scope should start at v1
      const { stdout: otherScope } = await runCommand(
        ['set', uniqueKey, '--scope', 'global'],
        'different scope'
      )
      expect(otherScope).toContain('_v1.txt')
    })
  })

  describe('error handling', () => {
    it('should show error when --branch used without branch scope', async () => {
      await expect(
        runCommand(['set', 'test-key', '--scope', 'repository', '--branch', 'main'], 'test content')
      ).rejects.toThrow()
    })

    it('should show error when --branch used with global scope', async () => {
      await expect(
        runCommand(['set', 'test-key', '--scope', 'global', '--branch', 'main'], 'test content')
      ).rejects.toThrow()
    })
  })
})
