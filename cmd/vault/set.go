package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/choplin/vault.md/internal/database"
	"github.com/choplin/vault.md/internal/scope"
	"github.com/choplin/vault.md/internal/usecase"
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

			sc, err := scope.ResolveScope(scope.ScopeOptions{
				Type:     scopeType,
				Repo:     repoPath,
				Branch:   branchName,
				Worktree: worktreeID,
			})
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
			var opts *usecase.SetOptions
			if strings.TrimSpace(description) != "" {
				d := description
				opts = &usecase.SetOptions{
					Description: &d,
				}
			}

			uc := usecase.NewEntry(dbCtx)
			path, err := uc.Set(ctx, sc, key, content, opts)
			if err != nil {
				return err
			}

			if _, err := fmt.Fprintln(cmd.OutOrStdout(), path); err != nil {
				return err
			}
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

func readContent(cmd *cobra.Command, filePath string) (string, error) {
	if filePath != "" {
		//nolint:gosec // G304: filePath is from user's --file flag, intentional file read
		bytes, err := os.ReadFile(filePath)
		if err != nil {
			return "", err
		}
		return string(bytes), nil
	}

	stat, err := os.Stdin.Stat()
	if err == nil && (stat.Mode()&os.ModeCharDevice) != 0 {
		if _, err := fmt.Fprintln(cmd.ErrOrStderr(), "Enter content (Ctrl-D when done):"); err != nil {
			return "", err
		}
	}

	bytes, err := io.ReadAll(os.Stdin)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}
