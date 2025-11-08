// Package scope provides scope management for vault entries across global, repository, branch, and worktree levels.
package scope

import (
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

// ScopeType defines the type of scope for vault entries.
//
//nolint:revive // ScopeType is intentionally prefixed for clarity in external contexts
type ScopeType string

// Scope type constants define the available scope levels.
const (
	ScopeGlobal     ScopeType = "global"
	ScopeRepository ScopeType = "repository"
	ScopeBranch     ScopeType = "branch"
	ScopeWorktree   ScopeType = "worktree"
)

// Scope represents the contextual unit for entries. Field expectations depend on Type
// and are documented in Validate.
type Scope struct {
	Type         ScopeType
	PrimaryPath  string
	BranchName   string
	WorktreeID   string
	WorktreePath string
}

var fileSanitizePattern = regexp.MustCompile(`[@/\\:?*"<>|]`)

// NewGlobal creates a new global scope.
func NewGlobal() Scope {
	return Scope{Type: ScopeGlobal}
}

// NewRepository creates a new repository scope with the given path.
func NewRepository(path string) Scope {
	return Scope{Type: ScopeRepository, PrimaryPath: path}
}

// NewBranch creates a new branch scope with the given repository path and branch name.
func NewBranch(path, branch string) Scope {
	return Scope{Type: ScopeBranch, PrimaryPath: path, BranchName: branch}
}

// NewWorktree creates a new worktree scope with the given repository path, worktree ID, and worktree path.
func NewWorktree(path, id, wtPath string) Scope {
	return Scope{Type: ScopeWorktree, PrimaryPath: path, WorktreeID: id, WorktreePath: wtPath}
}

// IsGlobal returns true if the scope is global.
func IsGlobal(s Scope) bool { return s.Type == ScopeGlobal }

// IsRepository returns true if the scope is repository-level.
func IsRepository(s Scope) bool { return s.Type == ScopeRepository }

// IsBranch returns true if the scope is branch-level.
func IsBranch(s Scope) bool { return s.Type == ScopeBranch }

// IsWorktree returns true if the scope is worktree-level.
func IsWorktree(s Scope) bool { return s.Type == ScopeWorktree }

// Validate enforces that each scope type carries the required fields:
//   - ScopeGlobal: no additional fields.
//   - ScopeRepository: PrimaryPath must be set.
//   - ScopeBranch: PrimaryPath and BranchName must be set.
//   - ScopeWorktree: PrimaryPath and WorktreeID must be set; WorktreePath is optional metadata.
func Validate(s Scope) error {
	switch s.Type {
	case ScopeGlobal:
		return nil
	case ScopeRepository:
		if err := ensureNonEmpty("repository scope requires a valid repository path", s.PrimaryPath); err != nil {
			return err
		}
		if s.PrimaryPath == string(ScopeGlobal) {
			return errors.New("repository path cannot be \"global\" (reserved for global scope)")
		}
		return nil
	case ScopeBranch:
		if err := ensureNonEmpty("branch scope requires a valid repository path", s.PrimaryPath); err != nil {
			return err
		}
		if err := ensureNonEmpty("branch scope requires a valid branch name", s.BranchName); err != nil {
			return err
		}
		if s.PrimaryPath == string(ScopeGlobal) {
			return errors.New("branch scope cannot use \"global\" as repository path")
		}
		if s.BranchName == string(ScopeRepository) {
			return errors.New("branch name \"repository\" is reserved for repository scope")
		}
		if s.BranchName == string(ScopeGlobal) {
			return errors.New("branch name \"global\" is reserved for global scope")
		}
		return nil
	case ScopeWorktree:
		if err := ensureNonEmpty("worktree scope requires a valid repository path", s.PrimaryPath); err != nil {
			return err
		}
		if err := ensureNonEmpty("worktree scope requires a worktree id", s.WorktreeID); err != nil {
			return err
		}
		if s.PrimaryPath == string(ScopeGlobal) {
			return errors.New("worktree scope cannot use \"global\" as repository path")
		}
		if s.WorktreeID == string(ScopeGlobal) {
			return errors.New("worktree id \"global\" is reserved for global scope")
		}
		if s.WorktreeID == string(ScopeRepository) {
			return errors.New("worktree id \"repository\" is reserved for repository scope")
		}
		return nil
	default:
		return fmt.Errorf("invalid scope type: %s", s.Type)
	}
}

// GetScopeStorageKey returns the storage key for a scope.
func GetScopeStorageKey(s Scope) string {
	return sanitizeForFile(FormatScope(s))
}

// FormatScope returns a formatted string representation of the scope.
func FormatScope(s Scope) string {
	switch s.Type {
	case ScopeGlobal:
		return "global"
	case ScopeRepository:
		return s.PrimaryPath
	case ScopeBranch:
		return s.PrimaryPath + ":" + s.BranchName
	case ScopeWorktree:
		return s.PrimaryPath + "@" + s.WorktreeID
	default:
		return ""
	}
}

// FormatScopeShort returns a short formatted string representation of the scope.
func FormatScopeShort(s Scope) string {
	switch s.Type {
	case ScopeGlobal:
		return "global"
	case ScopeRepository:
		return getDisplayName(s.PrimaryPath)
	case ScopeBranch:
		return getDisplayName(s.PrimaryPath) + ":" + s.BranchName
	case ScopeWorktree:
		return getDisplayName(s.PrimaryPath) + "@" + s.WorktreeID
	default:
		return ""
	}
}

// GetScopePrimaryPath returns the primary path of the scope.
func GetScopePrimaryPath(s Scope) string {
	return s.PrimaryPath
}

// GetScopeBranchName returns the branch name of the scope.
func GetScopeBranchName(s Scope) string {
	return s.BranchName
}

// GetScopeWorktreeID returns the worktree ID of the scope.
func GetScopeWorktreeID(s Scope) string {
	return s.WorktreeID
}

// GetScopeWorktreePath returns the worktree path of the scope.
func GetScopeWorktreePath(s Scope) string {
	return s.WorktreePath
}

func sanitizeForFile(value string) string {
	return fileSanitizePattern.ReplaceAllString(value, "-")
}

func getDisplayName(path string) string {
	if path == "" {
		return ""
	}
	if path == "/" {
		return "/"
	}
	trimmed := strings.TrimSuffix(path, "/")
	name := filepath.Base(trimmed)
	if name == "." || name == "" {
		return trimmed
	}
	return name
}

func ensureNonEmpty(msg, value string) error {
	if strings.TrimSpace(value) == "" {
		return errors.New(msg)
	}
	return nil
}
