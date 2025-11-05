package main

import (
	"context"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/vault-md/vaultmd/internal/database"
	"github.com/vault-md/vaultmd/internal/scope"
	"github.com/vault-md/vaultmd/internal/usecase"
)

func newGetCmd() *cobra.Command {
	var (
		versionFlag int
		allScopes   bool
		scopeType   string
		repoPath    string
		branchName  string
		worktreeID  string
	)

	cmd := &cobra.Command{
		Use:   "get <key>",
		Short: "Get entry content from the vault",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			key := args[0]

			sc, err := scope.ResolveScope(scope.ScopeOptions{
				Type:     scopeType,
				Repo:     repoPath,
				Branch:   branchName,
				Worktree: worktreeID,
			})
			if err != nil {
				return err
			}

			var opts *usecase.GetOptions
			if cmd.Flags().Changed("ver") || allScopes {
				opts = &usecase.GetOptions{
					AllScopes: allScopes,
				}
				if cmd.Flags().Changed("ver") {
					version := versionFlag
					opts.Version = &version
				}
			}

			dbCtx, err := database.CreateDatabase("")
			if err != nil {
				return err
			}
			defer func() {
				_ = database.CloseDatabase(dbCtx)
			}()

			ctx := context.Background()
			uc := usecase.NewEntry(dbCtx)
			result, err := uc.Get(ctx, sc, key, opts)
			if err != nil {
				return err
			}
			if result == nil {
				return fmt.Errorf("key not found: %s", key)
			}

			content, err := os.ReadFile(result.Record.FilePath)
			if err != nil {
				return err
			}

			if _, err := cmd.OutOrStdout().Write(content); err != nil {
				return err
			}
			return nil
		},
	}

	cmd.Flags().IntVarP(&versionFlag, "ver", "v", 0, "Specific version to retrieve")
	cmd.Flags().BoolVar(&allScopes, "all-scopes", false, "Search higher scopes if not found")
	cmd.Flags().StringVar(&scopeType, "scope", "", "Scope type: global, repository, branch, or worktree")
	cmd.Flags().StringVar(&repoPath, "repo", "", "Repository path for repository/branch/worktree scopes")
	cmd.Flags().StringVar(&branchName, "branch", "", "Branch name (requires --scope branch)")
	cmd.Flags().StringVar(&worktreeID, "worktree", "", "Worktree id (requires --scope worktree)")

	return cmd
}
