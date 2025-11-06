package main

import (
	"context"
	"crypto/sha256"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/choplin/vault.md/internal/database"
	"github.com/choplin/vault.md/internal/scope"
	"github.com/choplin/vault.md/internal/usecase"
)

func newEditCmd() *cobra.Command {
	var (
		versionFlag int
		scopeType   string
		repoPath    string
		branchName  string
		worktreeID  string
	)

	cmd := &cobra.Command{
		Use:   "edit <key>",
		Short: "Edit entry with $EDITOR",
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
			if cmd.Flags().Changed("version") {
				version := versionFlag
				opts = &usecase.GetOptions{
					Version: &version,
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

			// Get current entry
			result, err := uc.Get(ctx, sc, key, opts)
			if err != nil {
				return err
			}
			if result == nil {
				return fmt.Errorf("key not found: %s", key)
			}

			// Read current content
			currentContent, err := os.ReadFile(result.Record.FilePath)
			if err != nil {
				return err
			}

			// Create temporary directory and file
			tempDir, err := os.MkdirTemp("", "vault-edit-")
			if err != nil {
				return err
			}
			defer os.RemoveAll(tempDir)

			tempFile := filepath.Join(tempDir, key+".md")
			if err := os.WriteFile(tempFile, currentContent, 0600); err != nil {
				return err
			}

			// Get editor from environment
			editor := os.Getenv("EDITOR")
			if editor == "" {
				editor = os.Getenv("VISUAL")
			}
			if editor == "" {
				editor = "vi"
			}

			// Open editor
			editorCmd := exec.Command(editor, tempFile)
			editorCmd.Stdin = os.Stdin
			editorCmd.Stdout = os.Stdout
			editorCmd.Stderr = os.Stderr

			if err := editorCmd.Run(); err != nil {
				return fmt.Errorf("editor exited with error: %w", err)
			}

			// Read edited content
			editedContent, err := os.ReadFile(tempFile)
			if err != nil {
				return err
			}

			// Check if content changed (SHA256 hash comparison)
			currentHash := sha256.Sum256(currentContent)
			editedHash := sha256.Sum256(editedContent)

			if currentHash == editedHash {
				fmt.Fprintln(cmd.OutOrStdout(), "No changes made")
				return nil
			}

			// Save as new version
			description := fmt.Sprintf("Edited with %s", editor)
			_, err = uc.Set(ctx, sc, key, string(editedContent), &usecase.SetOptions{
				Description: &description,
			})
			if err != nil {
				return err
			}

			fmt.Fprintln(cmd.OutOrStdout(), "Entry updated")
			return nil
		},
	}

	cmd.Flags().IntVarP(&versionFlag, "version", "v", 0, "Edit specific version")
	cmd.Flags().StringVar(&scopeType, "scope", "", "Scope type: global, repository, branch, or worktree")
	cmd.Flags().StringVar(&repoPath, "repo", "", "Repository path for repository/branch/worktree scopes")
	cmd.Flags().StringVar(&branchName, "branch", "", "Branch name (requires --scope branch)")
	cmd.Flags().StringVar(&worktreeID, "worktree", "", "Worktree id (requires --scope worktree)")

	return cmd
}
