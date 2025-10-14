import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface GitInfo {
  isGitRepo: boolean
  primaryWorktreePath?: string
  currentWorktreePath?: string
  currentBranch?: string
  isWorktree?: boolean
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

    // Determine common directory (primary repository)
    const gitDir = execSync('git rev-parse --git-dir', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()

    const absoluteGitDir = resolve(dir, gitDir)
    const isWorktree = !existsSync(join(absoluteGitDir, 'objects'))

    let primaryWorktreePath = gitRoot

    try {
      const commonDir = execSync('git rev-parse --git-common-dir', {
        cwd: dir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim()
      primaryWorktreePath = resolve(dir, commonDir, '..')
    } catch {
      // Fallback to the current worktree root when common dir is unavailable
      primaryWorktreePath = gitRoot
    }

    // Get remote URL (optional)
    return {
      isGitRepo: true,
      primaryWorktreePath,
      currentWorktreePath: gitRoot,
      currentBranch: branch,
      isWorktree,
    }
  } catch {
    return { isGitRepo: false }
  }
}
