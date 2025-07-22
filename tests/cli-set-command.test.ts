import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, rmSync } from 'node:fs'
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
