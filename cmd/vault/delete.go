package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/choplin/vault.md/internal/database"
	"github.com/choplin/vault.md/internal/scope"
	"github.com/choplin/vault.md/internal/usecase"
)

func newDeleteCmd() *cobra.Command {
	var (
		versionFlag int
		force       bool
		scopeType   string
		repoPath    string
		branchName  string
		worktreeID  string
	)

	cmd := &cobra.Command{
		Use:   "delete <key>",
		Short: "Delete entry or specific version",
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

			// Confirmation prompt
			if !force {
				var message string
				if cmd.Flags().Changed("version") {
					message = fmt.Sprintf("Delete version %d of '%s'? (y/N) ", versionFlag, key)
				} else {
					message = fmt.Sprintf("Delete all versions of key '%s'? This key will be permanently removed. (y/N) ", key)
				}

				reader := bufio.NewReader(os.Stdin)
				fmt.Fprint(cmd.ErrOrStderr(), message)
				answer, err := reader.ReadString('\n')
				if err != nil {
					return err
				}

				answer = strings.TrimSpace(strings.ToLower(answer))
				if answer != "y" {
					fmt.Fprintln(cmd.OutOrStdout(), "Deletion cancelled")
					return nil
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

			// Execute deletion
			if cmd.Flags().Changed("version") {
				deleted, err := uc.DeleteVersion(ctx, sc, key, versionFlag)
				if err != nil {
					return err
				}
				if !deleted {
					return fmt.Errorf("version %d of key '%s' not found", versionFlag, key)
				}
				fmt.Fprintf(cmd.OutOrStdout(), "Deleted version %d of '%s'\n", versionFlag, key)
			} else {
				count, err := uc.DeleteKey(ctx, sc, key)
				if err != nil {
					return err
				}
				if count == 0 {
					return fmt.Errorf("key '%s' not found", key)
				}
				if count == 1 {
					fmt.Fprintf(cmd.OutOrStdout(), "Deleted 1 version of '%s'\n", key)
				} else {
					fmt.Fprintf(cmd.OutOrStdout(), "Deleted %d versions of '%s'\n", count, key)
				}
			}

			return nil
		},
	}

	cmd.Flags().IntVar(&versionFlag, "version", 0, "Specific version to delete")
	cmd.Flags().BoolVar(&force, "force", false, "Skip confirmation prompt")
	cmd.Flags().StringVar(&scopeType, "scope", "", "Scope type: global, repository, branch, or worktree")
	cmd.Flags().StringVar(&repoPath, "repo", "", "Repository path for repository/branch/worktree scopes")
	cmd.Flags().StringVar(&branchName, "branch", "", "Branch name (requires --scope branch)")
	cmd.Flags().StringVar(&worktreeID, "worktree", "", "Worktree id (requires --scope worktree)")

	return cmd
}
