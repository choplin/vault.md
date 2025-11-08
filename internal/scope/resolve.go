package scope

import (
	"fmt"

	"github.com/choplin/vault.md/internal/git"
)

// ScopeOptions contains options for resolving a scope from CLI/MCP input
//
//nolint:revive // ScopeOptions is intentionally prefixed for clarity in external contexts
type ScopeOptions struct {
	Type       string
	Repo       string
	Branch     string
	Worktree   string
	WorkingDir string // Directory to detect git info from (empty = current dir)
}

// ResolveScope converts CLI/MCP-level scope options into a validated Scope.
// If no scope type is specified, it defaults to 'repository' and attempts to
// auto-detect git repository information.
func ResolveScope(opts ScopeOptions) (Scope, error) {
	// Default to repository scope if not specified
	scopeType := ScopeType(opts.Type)
	if scopeType == "" {
		scopeType = ScopeRepository
	}

	switch scopeType {
	case ScopeGlobal:
		if opts.Repo != "" || opts.Branch != "" || opts.Worktree != "" {
			return Scope{}, fmt.Errorf("--repo, --branch, and --worktree require an explicit --scope")
		}
		s := NewGlobal()
		return s, Validate(s)

	case ScopeRepository:
		// Auto-detect repository if not explicitly provided
		repo := opts.Repo
		if repo == "" {
			gitInfo, err := git.GetGitInfo(opts.WorkingDir)
			if err == nil && gitInfo.IsGitRepo {
				repo = gitInfo.PrimaryWorktreePath
			} else {
				// If not in a git repository and no explicit repo provided, use global scope
				s := NewGlobal()
				return s, Validate(s)
			}
		}

		if repo == "" {
			return Scope{}, fmt.Errorf("--scope repository requires --repo or must be run from a git repository")
		}

		s := NewRepository(repo)
		return s, Validate(s)

	case ScopeBranch:
		// Auto-detect repository and branch if not explicitly provided
		repo := opts.Repo
		branch := opts.Branch

		if repo == "" || branch == "" {
			gitInfo, err := git.GetGitInfo(opts.WorkingDir)
			if err == nil && gitInfo.IsGitRepo {
				if repo == "" {
					repo = gitInfo.PrimaryWorktreePath
				}
				if branch == "" {
					branch = gitInfo.CurrentBranch
				}
			}
		}

		if repo == "" || branch == "" {
			return Scope{}, fmt.Errorf("--scope branch requires both --repo and --branch, or must be run from a git repository")
		}

		s := NewBranch(repo, branch)
		return s, Validate(s)

	case ScopeWorktree:
		// Auto-detect repository and worktree if not explicitly provided
		repo := opts.Repo
		worktree := opts.Worktree

		if repo == "" || worktree == "" {
			gitInfo, err := git.GetGitInfo(opts.WorkingDir)
			if err == nil && gitInfo.IsGitRepo {
				if repo == "" {
					repo = gitInfo.PrimaryWorktreePath
				}
				if worktree == "" {
					worktree = gitInfo.WorktreeID
				}
			}
		}

		if repo == "" || worktree == "" {
			return Scope{}, fmt.Errorf("--scope worktree requires both --repo and --worktree, or must be run from a git worktree")
		}

		s := NewWorktree(repo, worktree, "")
		return s, Validate(s)

	default:
		return Scope{}, fmt.Errorf("invalid scope: %s (valid values: global, repository, branch, worktree)", opts.Type)
	}
}
