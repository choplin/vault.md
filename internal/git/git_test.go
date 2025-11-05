package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestGetGitInfo_NotGitRepo(t *testing.T) {
	// Create a temporary directory that's not a git repository
	tmpDir := t.TempDir()

	info, err := GetGitInfo(tmpDir)
	if err != nil {
		t.Fatalf("GetGitInfo returned error: %v", err)
	}

	if info.IsGitRepo {
		t.Error("Expected IsGitRepo to be false for non-git directory")
	}
}

func TestGetGitInfo_GitRepo(t *testing.T) {
	// Create a temporary directory and initialize git
	tmpDir := t.TempDir()

	// Initialize git repository
	cmd := exec.Command("git", "init")
	cmd.Dir = tmpDir
	if err := cmd.Run(); err != nil {
		t.Skipf("Skipping test: git init failed: %v", err)
	}

	// Configure git user for the test repo
	configUser := exec.Command("git", "config", "user.email", "test@example.com")
	configUser.Dir = tmpDir
	if err := configUser.Run(); err != nil {
		t.Skipf("Skipping test: git config user.email failed: %v", err)
	}

	configName := exec.Command("git", "config", "user.name", "Test User")
	configName.Dir = tmpDir
	if err := configName.Run(); err != nil {
		t.Skipf("Skipping test: git config user.name failed: %v", err)
	}

	// Create an initial commit
	testFile := filepath.Join(tmpDir, "test.txt")
	if err := os.WriteFile(testFile, []byte("test"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	addCmd := exec.Command("git", "add", "test.txt")
	addCmd.Dir = tmpDir
	if err := addCmd.Run(); err != nil {
		t.Skipf("Skipping test: git add failed: %v", err)
	}

	commitCmd := exec.Command("git", "commit", "-m", "Initial commit")
	commitCmd.Dir = tmpDir
	if err := commitCmd.Run(); err != nil {
		t.Skipf("Skipping test: git commit failed: %v", err)
	}

	info, err := GetGitInfo(tmpDir)
	if err != nil {
		t.Fatalf("GetGitInfo returned error: %v", err)
	}

	if !info.IsGitRepo {
		t.Error("Expected IsGitRepo to be true for git repository")
	}

	if info.PrimaryWorktreePath == "" {
		t.Error("Expected PrimaryWorktreePath to be set")
	}

	if info.CurrentBranch == "" {
		t.Error("Expected CurrentBranch to be set")
	}

	// For a primary worktree, WorktreeID should be "primary"
	if info.WorktreeID != "primary" {
		t.Errorf("Expected WorktreeID to be 'primary', got %q", info.WorktreeID)
	}

	// For a primary worktree, IsWorktree should be false
	if info.IsWorktree {
		t.Error("Expected IsWorktree to be false for primary worktree")
	}
}

func TestGetGitInfo_EmptyDir(t *testing.T) {
	// Test with empty string - should use current working directory
	info, err := GetGitInfo("")
	if err != nil {
		t.Fatalf("GetGitInfo returned error: %v", err)
	}

	// We're running this test from a git repository (vault.md),
	// so it should detect the repository
	if !info.IsGitRepo {
		t.Error("Expected IsGitRepo to be true when running from vault.md repository")
	}
}

func TestGetGitInfo_Worktree(t *testing.T) {
	// Create a temporary directory and initialize git
	tmpDir := t.TempDir()

	// Initialize git repository
	cmd := exec.Command("git", "init")
	cmd.Dir = tmpDir
	if err := cmd.Run(); err != nil {
		t.Skipf("Skipping test: git init failed: %v", err)
	}

	// Configure git user
	configUser := exec.Command("git", "config", "user.email", "test@example.com")
	configUser.Dir = tmpDir
	if err := configUser.Run(); err != nil {
		t.Skipf("Skipping test: git config user.email failed: %v", err)
	}

	configName := exec.Command("git", "config", "user.name", "Test User")
	configName.Dir = tmpDir
	if err := configName.Run(); err != nil {
		t.Skipf("Skipping test: git config user.name failed: %v", err)
	}

	// Create an initial commit
	testFile := filepath.Join(tmpDir, "test.txt")
	if err := os.WriteFile(testFile, []byte("test"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	addCmd := exec.Command("git", "add", "test.txt")
	addCmd.Dir = tmpDir
	if err := addCmd.Run(); err != nil {
		t.Skipf("Skipping test: git add failed: %v", err)
	}

	commitCmd := exec.Command("git", "commit", "-m", "Initial commit")
	commitCmd.Dir = tmpDir
	if err := commitCmd.Run(); err != nil {
		t.Skipf("Skipping test: git commit failed: %v", err)
	}

	// Create a worktree
	worktreePath := filepath.Join(tmpDir, "worktree-test")
	worktreeCmd := exec.Command("git", "worktree", "add", worktreePath, "-b", "test-branch")
	worktreeCmd.Dir = tmpDir
	if err := worktreeCmd.Run(); err != nil {
		t.Skipf("Skipping test: git worktree add failed: %v", err)
	}

	// Get git info from the worktree
	info, err := GetGitInfo(worktreePath)
	if err != nil {
		t.Fatalf("GetGitInfo returned error: %v", err)
	}

	if !info.IsGitRepo {
		t.Error("Expected IsGitRepo to be true for worktree")
	}

	if !info.IsWorktree {
		t.Error("Expected IsWorktree to be true for secondary worktree")
	}

	if info.WorktreeID == "primary" {
		t.Error("Expected WorktreeID to not be 'primary' for secondary worktree")
	}

	if info.CurrentBranch != "test-branch" {
		t.Errorf("Expected CurrentBranch to be 'test-branch', got %q", info.CurrentBranch)
	}
}
