// Package git provides utilities for detecting and working with git repositories.
package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// GitInfo contains information about a git repository
//
//nolint:revive // GitInfo is intentionally prefixed to avoid overly generic "Info" type
type GitInfo struct {
	IsGitRepo           bool
	PrimaryWorktreePath string
	CurrentWorktreePath string
	CurrentBranch       string
	IsWorktree          bool
	WorktreeID          string
	WorktreePath        string
}

// GetGitInfo retrieves git repository information for the given directory.
// If dir is empty, it uses the current working directory.
// Returns a GitInfo with IsGitRepo=false if the directory is not a git repository.
func GetGitInfo(dir string) (*GitInfo, error) {
	if dir == "" {
		var err error
		dir, err = os.Getwd()
		if err != nil {
			//nolint:nilerr // Intentionally return non-repo info instead of error
			return &GitInfo{IsGitRepo: false}, nil
		}
	}

	// Check if it's a git repository
	gitRoot, err := runGitCommand(dir, "rev-parse", "--show-toplevel")
	if err != nil {
		//nolint:nilerr // Intentionally return non-repo info instead of error
		return &GitInfo{IsGitRepo: false}, nil
	}

	if gitRoot == "" {
		return &GitInfo{IsGitRepo: false}, nil
	}

	// Get current branch
	branch, err := runGitCommand(dir, "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		//nolint:nilerr // Intentionally return non-repo info instead of error
		return &GitInfo{IsGitRepo: false}, nil
	}

	// Get git directory
	gitDir, err := runGitCommand(dir, "rev-parse", "--git-dir")
	if err != nil {
		//nolint:nilerr // Intentionally return non-repo info instead of error
		return &GitInfo{IsGitRepo: false}, nil
	}

	// Determine if this is a worktree
	absoluteGitDir := gitDir
	if !filepath.IsAbs(gitDir) {
		absoluteGitDir = filepath.Join(dir, gitDir)
	}

	objectsPath := filepath.Join(absoluteGitDir, "objects")
	_, err = os.Stat(objectsPath)
	isWorktree := os.IsNotExist(err)

	// Determine primary worktree path
	primaryWorktreePath := gitRoot

	// Try to get common directory for primary worktree path
	commonDir, err := runGitCommand(dir, "rev-parse", "--git-common-dir")
	if err == nil && commonDir != "" {
		// Common dir is relative to the git dir, so resolve it
		if !filepath.IsAbs(commonDir) {
			commonDir = filepath.Join(dir, commonDir)
		}
		// Primary worktree is the parent of common dir
		primaryWorktreePath = filepath.Dir(commonDir)
	}

	// Determine worktree ID
	worktreeBasename := filepath.Base(absoluteGitDir)
	worktreeID := worktreeBasename
	if worktreeBasename == ".git" {
		worktreeID = "primary"
	}

	return &GitInfo{
		IsGitRepo:           true,
		PrimaryWorktreePath: primaryWorktreePath,
		CurrentWorktreePath: gitRoot,
		CurrentBranch:       branch,
		IsWorktree:          isWorktree,
		WorktreeID:          worktreeID,
		WorktreePath:        gitRoot,
	}, nil
}

// runGitCommand executes a git command and returns the trimmed output
func runGitCommand(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	// Suppress stderr to avoid noise when not in a git repository
	cmd.Stderr = nil

	output, err := cmd.Output()
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(output)), nil
}
