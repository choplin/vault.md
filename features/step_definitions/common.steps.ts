import { Given, When, Then, Before, After, setDefaultTimeout } from '@cucumber/cucumber'
import { expect } from 'chai'
import { execSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Set timeout for all steps to 10 seconds
setDefaultTimeout(10 * 1000)

// World context to share data between steps
interface CustomWorld {
  tempDir: string
  gitRepoDir: string
  nonGitDir: string
  originalCwd: string
  lastOutput: string
  lastExitCode: number
  cliPath: string
}

declare module '@cucumber/cucumber' {
  interface World extends CustomWorld {}
}

Before(function(this: CustomWorld) {
  this.originalCwd = process.cwd()
  this.cliPath = join(this.originalCwd, 'dist', 'cli.js')

  // Create temporary directories
  this.tempDir = mkdtempSync(join(tmpdir(), 'vault-cucumber-'))
  this.gitRepoDir = join(this.tempDir, 'git-repo')
  this.nonGitDir = join(this.tempDir, 'non-git')

  mkdirSync(this.gitRepoDir, { recursive: true })
  mkdirSync(this.nonGitDir, { recursive: true })

  // Set VAULT_DIR for tests
  process.env.VAULT_DIR = this.tempDir
})

After(function(this: CustomWorld) {
  // Restore working directory
  process.chdir(this.originalCwd)

  // Clean up
  if (this.tempDir) {
    rmSync(this.tempDir, { recursive: true, force: true })
  }
  delete process.env.VAULT_DIR
})

Given('I have a temporary test directory', function(this: CustomWorld) {
  process.chdir(this.gitRepoDir)
})

Given('I am in a non-git directory', function(this: CustomWorld) {
  process.chdir(this.nonGitDir)
})

Given('I have initialized a git repository', function(this: CustomWorld) {
  execSync('git init', { cwd: process.cwd() })
  execSync('git config user.email "test@example.com"', { cwd: process.cwd() })
  execSync('git config user.name "Test User"', { cwd: process.cwd() })
})

Given('I have created a test file {string} with content {string}', function(this: CustomWorld, filename: string, content: string) {
  writeFileSync(join(process.cwd(), filename), content)

  // Only commit if we're in a git repository
  try {
    execSync('git rev-parse --git-dir', { cwd: process.cwd() })
    execSync('git add .', { cwd: process.cwd() })
    execSync('git commit -m "Add test file"', { cwd: process.cwd() })
  } catch {
    // Not in a git repo, skip commit
  }
})

Given('I have created a git branch {string}', function(this: CustomWorld, branchName: string) {
  execSync(`git checkout -b ${branchName}`, { cwd: process.cwd() })
})

When('I switch to git branch {string}', function(this: CustomWorld, branchName: string) {
  execSync(`git checkout ${branchName}`, { cwd: process.cwd() })
})

When('I run {string}', function(this: CustomWorld, command: string) {
  try {
    // Replace 'vault' with the actual CLI path
    const actualCommand = command.replace(/^vault/, `node ${this.cliPath}`)
    this.lastOutput = execSync(actualCommand, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env }
    }).trim()
    this.lastExitCode = 0
  } catch (error: any) {
    this.lastOutput = error.stdout?.trim() || ''
    this.lastExitCode = error.status || 1

    // Store stderr for error checking
    if (error.stderr) {
      this.lastOutput = error.stderr.trim()
    }
  }
})

Then('the command should succeed', function(this: CustomWorld) {
  expect(this.lastExitCode).to.equal(0, `Command failed with exit code ${this.lastExitCode}. Output: ${this.lastOutput}`)
})

Then('the command should fail with {string}', function(this: CustomWorld, expectedError: string) {
  expect(this.lastExitCode).to.not.equal(0, 'Command should have failed but succeeded')
  expect(this.lastOutput).to.include(expectedError)
})

Then('the output should be {string}', function(this: CustomWorld, expected: string) {
  expect(this.lastOutput).to.equal(expected)
})

Then('the output should contain {string}', function(this: CustomWorld, expected: string) {
  expect(this.lastOutput).to.include(expected)
})

Then('the JSON output should have {string} equal to {int}', function(this: CustomWorld, property: string, expected: number) {
  const json = JSON.parse(this.lastOutput)
  expect(json[property]).to.equal(expected)
})
