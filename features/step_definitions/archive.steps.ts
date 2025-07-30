import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { execSync } from 'child_process'

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

Given('a new vault', function(this: CustomWorld) {
  // The vault is already clean because we use a temp directory
  // Just change to the git repo directory
  process.chdir(this.gitRepoDir)
})

When('I run `vault set {word}` with content {string}', function(this: CustomWorld, key: string, content: string) {
  try {
    const command = `echo "${content}" | node ${this.cliPath} set ${key}`
    this.lastOutput = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env }
    }).trim()
    this.lastExitCode = 0
  } catch (error: any) {
    this.lastOutput = error.stdout?.trim() || ''
    this.lastExitCode = error.status || 1
    if (error.stderr) {
      this.lastOutput = error.stderr.trim()
    }
  }
})

When('I run `vault set {word} --scope {word}` with content {string}', function(this: CustomWorld, key: string, scope: string, content: string) {
  try {
    const command = `echo "${content}" | node ${this.cliPath} set ${key} --scope ${scope}`
    this.lastOutput = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env }
    }).trim()
    this.lastExitCode = 0
  } catch (error: any) {
    this.lastOutput = error.stdout?.trim() || ''
    this.lastExitCode = error.status || 1
    if (error.stderr) {
      this.lastOutput = error.stderr.trim()
    }
  }
})

When('I run `vault archive {word}`', function(this: CustomWorld, key: string) {
  try {
    const command = `node ${this.cliPath} archive ${key}`
    this.lastOutput = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env }
    }).trim()
    this.lastExitCode = 0
  } catch (error: any) {
    this.lastOutput = error.stdout?.trim() || ''
    this.lastExitCode = error.status || 1
    if (error.stderr) {
      this.lastOutput = error.stderr.trim()
    }
  }
})

When('I run `vault archive {word} --scope {word}`', function(this: CustomWorld, key: string, scope: string) {
  try {
    const command = `node ${this.cliPath} archive ${key} --scope ${scope}`
    this.lastOutput = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env }
    }).trim()
    this.lastExitCode = 0
  } catch (error: any) {
    this.lastOutput = error.stdout?.trim() || ''
    this.lastExitCode = error.status || 1
    if (error.stderr) {
      this.lastOutput = error.stderr.trim()
    }
  }
})

When('I run `vault restore {word}`', function(this: CustomWorld, key: string) {
  try {
    const command = `node ${this.cliPath} restore ${key}`
    this.lastOutput = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env }
    }).trim()
    this.lastExitCode = 0
  } catch (error: any) {
    this.lastOutput = error.stdout?.trim() || ''
    this.lastExitCode = error.status || 1
    if (error.stderr) {
      this.lastOutput = error.stderr.trim()
    }
  }
})

When('I run `vault restore {word} --scope {word}`', function(this: CustomWorld, key: string, scope: string) {
  try {
    const command = `node ${this.cliPath} restore ${key} --scope ${scope}`
    this.lastOutput = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env }
    }).trim()
    this.lastExitCode = 0
  } catch (error: any) {
    this.lastOutput = error.stdout?.trim() || ''
    this.lastExitCode = error.status || 1
    if (error.stderr) {
      this.lastOutput = error.stderr.trim()
    }
  }
})

When('I run `vault list`', function(this: CustomWorld) {
  try {
    const command = `node ${this.cliPath} list`
    this.lastOutput = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env }
    }).trim()
    this.lastExitCode = 0
  } catch (error: any) {
    this.lastOutput = error.stdout?.trim() || ''
    this.lastExitCode = error.status || 1
    if (error.stderr) {
      this.lastOutput = error.stderr.trim()
    }
  }
})

When('I run `vault list --include-archived`', function(this: CustomWorld) {
  try {
    const command = `node ${this.cliPath} list --include-archived`
    this.lastOutput = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env }
    }).trim()
    this.lastExitCode = 0
  } catch (error: any) {
    this.lastOutput = error.stdout?.trim() || ''
    this.lastExitCode = error.status || 1
    if (error.stderr) {
      this.lastOutput = error.stderr.trim()
    }
  }
})

When('I run `vault list --scope {word}`', function(this: CustomWorld, scope: string) {
  try {
    const command = `node ${this.cliPath} list --scope ${scope}`
    this.lastOutput = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env }
    }).trim()
    this.lastExitCode = 0
  } catch (error: any) {
    this.lastOutput = error.stdout?.trim() || ''
    this.lastExitCode = error.status || 1
    if (error.stderr) {
      this.lastOutput = error.stderr.trim()
    }
  }
})

Then('the command should succeed with output {string}', function(this: CustomWorld, expectedOutput: string) {
  expect(this.lastExitCode).to.equal(0, `Command failed with exit code ${this.lastExitCode}. Output: ${this.lastOutput}`)
  expect(this.lastOutput).to.include(expectedOutput)
})

Then('the command should fail with error {string}', function(this: CustomWorld, expectedError: string) {
  expect(this.lastExitCode).to.not.equal(0, 'Command should have failed but succeeded')
  expect(this.lastOutput).to.include(expectedError)
})

Then('the output should not contain {string}', function(this: CustomWorld, unexpected: string) {
  expect(this.lastOutput).to.not.include(unexpected)
})

Then('the output should contain {string} in the archived column', function(this: CustomWorld, expected: string) {
  // Check that the output contains the expected value in a table format
  // The archived column should show "Yes" or "No"
  expect(this.lastOutput).to.include(expected)
  // Also verify it's in a table format by checking for table borders
  expect(this.lastOutput).to.match(/[│├─┤]+/)
})
