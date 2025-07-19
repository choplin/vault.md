import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface GitInfo {
  isGitRepo: boolean
  repoRoot?: string
  currentBranch?: string
  isWorktree?: boolean
  remoteUrl?: string
}

/**
 * Get git repository information for the given directory
 */
export function getGitInfo(dir: string = process.cwd()): GitInfo {
  try {
    // Check if it's a git repository
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()

    if (!gitRoot) {
      return { isGitRepo: false }
    }

    // Get current branch
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()

    // Check if it's a worktree
    const gitDir = execSync('git rev-parse --git-dir', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()

    const absoluteGitDir = resolve(dir, gitDir)
    const isWorktree = !existsSync(join(absoluteGitDir, 'objects'))

    // Get remote URL (optional)
    let remoteUrl: string | undefined
    try {
      remoteUrl = execSync('git config --get remote.origin.url', {
        cwd: dir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim()
    } catch {
      // Remote URL is optional
    }

    return {
      isGitRepo: true,
      repoRoot: gitRoot,
      currentBranch: branch,
      isWorktree,
      remoteUrl,
    }
  } catch {
    return { isGitRepo: false }
  }
}

/**
 * Get the main repository root for a worktree
 */
export function getMainRepoRoot(worktreeDir: string): string | undefined {
  try {
    const gitDir = execSync('git rev-parse --git-dir', {
      cwd: worktreeDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()

    const absoluteGitDir = resolve(worktreeDir, gitDir)

    // If it's a worktree, the .git file contains the path to the real git directory
    if (existsSync(join(worktreeDir, '.git')) && !existsSync(join(absoluteGitDir, 'objects'))) {
      // Read the commondir file to get the main repo
      const commonDirPath = join(absoluteGitDir, 'commondir')
      if (existsSync(commonDirPath)) {
        const commonDir = execSync(`cat "${commonDirPath}"`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'ignore'],
        }).trim()

        // commondir is relative to the git directory
        const mainGitDir = resolve(absoluteGitDir, commonDir)
        // Go up one level from .git to get the repo root
        return resolve(mainGitDir, '..')
      }
    }

    return worktreeDir
  } catch {
    return undefined
  }
}
