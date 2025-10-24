package scope

import (
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

type ScopeType string

const (
	ScopeGlobal     ScopeType = "global"
	ScopeRepository ScopeType = "repository"
	ScopeBranch     ScopeType = "branch"
	ScopeWorktree   ScopeType = "worktree"
)

type Scope struct {
	Type         ScopeType
	PrimaryPath  string
	BranchName   string
	WorktreeID   string
	WorktreePath string
}

var fileSanitizePattern = regexp.MustCompile(`[@/\\:?*"<>|]`)

func NewGlobal() Scope {
	return Scope{Type: ScopeGlobal}
}

func NewRepository(path string) Scope {
	return Scope{Type: ScopeRepository, PrimaryPath: path}
}

func NewBranch(path, branch string) Scope {
	return Scope{Type: ScopeBranch, PrimaryPath: path, BranchName: branch}
}

func NewWorktree(path, id, wtPath string) Scope {
	return Scope{Type: ScopeWorktree, PrimaryPath: path, WorktreeID: id, WorktreePath: wtPath}
}

func IsGlobal(s Scope) bool     { return s.Type == ScopeGlobal }
func IsRepository(s Scope) bool { return s.Type == ScopeRepository }
func IsBranch(s Scope) bool     { return s.Type == ScopeBranch }
func IsWorktree(s Scope) bool   { return s.Type == ScopeWorktree }

func Validate(s Scope) error {
	switch s.Type {
	case ScopeGlobal:
		return nil
	case ScopeRepository:
		if err := ensureNonEmpty("Repository scope requires a valid repository path", s.PrimaryPath); err != nil {
			return err
		}
		if s.PrimaryPath == string(ScopeGlobal) {
			return errors.New("Repository path cannot be \"global\" (reserved for global scope)")
		}
		return nil
	case ScopeBranch:
		if err := ensureNonEmpty("Branch scope requires a valid repository path", s.PrimaryPath); err != nil {
			return err
		}
		if err := ensureNonEmpty("Branch scope requires a valid branch name", s.BranchName); err != nil {
			return err
		}
		if s.PrimaryPath == string(ScopeGlobal) {
			return errors.New("Branch scope cannot use \"global\" as repository path")
		}
		if s.BranchName == string(ScopeRepository) {
			return errors.New("Branch name \"repository\" is reserved for repository scope")
		}
		if s.BranchName == string(ScopeGlobal) {
			return errors.New("Branch name \"global\" is reserved for global scope")
		}
		return nil
	case ScopeWorktree:
		if err := ensureNonEmpty("Worktree scope requires a valid repository path", s.PrimaryPath); err != nil {
			return err
		}
		if err := ensureNonEmpty("Worktree scope requires a worktree id", s.WorktreeID); err != nil {
			return err
		}
		if s.PrimaryPath == string(ScopeGlobal) {
			return errors.New("Worktree scope cannot use \"global\" as repository path")
		}
		if s.WorktreeID == string(ScopeGlobal) {
			return errors.New("Worktree id \"global\" is reserved for global scope")
		}
		if s.WorktreeID == string(ScopeRepository) {
			return errors.New("Worktree id \"repository\" is reserved for repository scope")
		}
		return nil
	default:
		return fmt.Errorf("invalid scope type: %s", s.Type)
	}
}

func GetScopeStorageKey(s Scope) string {
	return sanitizeForFile(FormatScope(s))
}

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

func GetScopePrimaryPath(s Scope) string {
	return s.PrimaryPath
}

func GetScopeBranchName(s Scope) string {
	return s.BranchName
}

func GetScopeWorktreeID(s Scope) string {
	return s.WorktreeID
}

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
