package usecase

import (
	"fmt"

	"github.com/vault-md/vaultmd/internal/scope"
)

type ScopeOptions struct {
	Type     string
	Repo     string
	Branch   string
	Worktree string
}

// ResolveScope converts CLI/MCP-level scope options into a validated scope.Scope.
func ResolveScope(opts ScopeOptions) (scope.Scope, error) {
	switch scope.ScopeType(opts.Type) {
	case "", scope.ScopeGlobal:
		if opts.Repo != "" || opts.Branch != "" || opts.Worktree != "" {
			return scope.Scope{}, fmt.Errorf("--repo, --branch, and --worktree require an explicit --scope")
		}
		s := scope.NewGlobal()
		return s, scope.Validate(s)
	case scope.ScopeRepository:
		if opts.Repo == "" {
			return scope.Scope{}, fmt.Errorf("--scope repository requires --repo")
		}
		s := scope.NewRepository(opts.Repo)
		return s, scope.Validate(s)
	case scope.ScopeBranch:
		if opts.Repo == "" || opts.Branch == "" {
			return scope.Scope{}, fmt.Errorf("--scope branch requires both --repo and --branch")
		}
		s := scope.NewBranch(opts.Repo, opts.Branch)
		return s, scope.Validate(s)
	case scope.ScopeWorktree:
		if opts.Repo == "" || opts.Worktree == "" {
			return scope.Scope{}, fmt.Errorf("--scope worktree requires both --repo and --worktree")
		}
		s := scope.NewWorktree(opts.Repo, opts.Worktree, "")
		return s, scope.Validate(s)
	default:
		return scope.Scope{}, fmt.Errorf("invalid scope: %s (valid values: global, repository, branch, worktree)", opts.Type)
	}
}
