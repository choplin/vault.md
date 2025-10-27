package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/vault-md/vaultmd/internal/application"
	"github.com/vault-md/vaultmd/internal/database"
	"github.com/vault-md/vaultmd/internal/scope"
)

func newSetCmd() *cobra.Command {
	var (
		filePath    string
		description string
		scopeType   string
		repoPath    string
		branchName  string
		worktreeID  string
	)

	cmd := &cobra.Command{
		Use:   "set <key>",
		Short: "Save content to the vault",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			key := args[0]

			sc, err := resolveScopeFlags(scopeType, repoPath, branchName, worktreeID)
			if err != nil {
				return err
			}

			content, err := readContent(cmd, filePath)
			if err != nil {
				return err
			}

			dbCtx, err := database.CreateDatabase("")
			if err != nil {
				return err
			}
			defer func() {
				_ = database.CloseDatabase(dbCtx)
			}()

			ctx := context.Background()
			var descPtr *string
			if strings.TrimSpace(description) != "" {
				d := description
				descPtr = &d
			}

			path, err := application.SetEntry(ctx, dbCtx, application.SetEntryInput{
				Scope:       sc,
				Key:         key,
				Content:     content,
				Description: descPtr,
			})
			if err != nil {
				return err
			}

			fmt.Fprintln(cmd.OutOrStdout(), path)
			return nil
		},
	}

	cmd.Flags().StringVarP(&filePath, "file", "f", "", "Read content from file instead of stdin")
	cmd.Flags().StringVarP(&description, "description", "d", "", "Add description metadata")
	cmd.Flags().StringVar(&scopeType, "scope", "", "Scope type: global, repository, branch, or worktree")
	cmd.Flags().StringVar(&repoPath, "repo", "", "Repository path for repository/branch/worktree scopes")
	cmd.Flags().StringVar(&branchName, "branch", "", "Branch name (requires --scope branch)")
	cmd.Flags().StringVar(&worktreeID, "worktree", "", "Worktree id (requires --scope worktree)")

	return cmd
}

func resolveScopeFlags(scopeFlag, repoPath, branchName, worktreeID string) (scope.Scope, error) {
	switch scope.ScopeType(scopeFlag) {
	case "", scope.ScopeGlobal:
		if branchName != "" || worktreeID != "" || repoPath != "" {
			return scope.Scope{}, errors.New("--repo, --branch, and --worktree require an explicit --scope")
		}
		sc := scope.NewGlobal()
		return sc, scope.Validate(sc)
	case scope.ScopeRepository:
		if repoPath == "" {
			return scope.Scope{}, errors.New("--scope repository requires --repo")
		}
		sc := scope.NewRepository(repoPath)
		return sc, scope.Validate(sc)
	case scope.ScopeBranch:
		if repoPath == "" || branchName == "" {
			return scope.Scope{}, errors.New("--scope branch requires both --repo and --branch")
		}
		sc := scope.NewBranch(repoPath, branchName)
		return sc, scope.Validate(sc)
	case scope.ScopeWorktree:
		if repoPath == "" || worktreeID == "" {
			return scope.Scope{}, errors.New("--scope worktree requires both --repo and --worktree")
		}
		sc := scope.NewWorktree(repoPath, worktreeID, "")
		return sc, scope.Validate(sc)
	default:
		return scope.Scope{}, fmt.Errorf("invalid scope: %s (valid values: global, repository, branch, worktree)", scopeFlag)
	}
}

func readContent(cmd *cobra.Command, filePath string) (string, error) {
	if filePath != "" {
		bytes, err := os.ReadFile(filePath)
		if err != nil {
			return "", err
		}
		return string(bytes), nil
	}

	stat, err := os.Stdin.Stat()
	if err == nil && (stat.Mode()&os.ModeCharDevice) != 0 {
		fmt.Fprintln(cmd.ErrOrStderr(), "Enter content (Ctrl-D when done):")
	}

	bytes, err := io.ReadAll(os.Stdin)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}
