package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/spf13/cobra"

	"github.com/vault-md/vaultmd/internal/database"
	"github.com/vault-md/vaultmd/internal/scope"
	"github.com/vault-md/vaultmd/internal/usecase"
)

func newInfoCmd() *cobra.Command {
	var (
		versionFlag int
		format      string
		scopeType   string
		repoPath    string
		branchName  string
		worktreeID  string
	)

	cmd := &cobra.Command{
		Use:   "info <key>",
		Short: "Show entry metadata",
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
			if cmd.Flags().Changed("ver") {
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
			result, err := uc.Get(ctx, sc, key, opts)
			if err != nil {
				return err
			}
			if result == nil {
				return fmt.Errorf("key not found: %s", key)
			}

			switch format {
			case "json":
				return outputInfoJSON(cmd, result)
			case "table":
				return outputInfoTable(cmd, result)
			default:
				return fmt.Errorf("invalid format: %s (valid values: table, json)", format)
			}
		},
	}

	cmd.Flags().IntVarP(&versionFlag, "ver", "v", 0, "Specific version to retrieve")
	cmd.Flags().StringVar(&format, "format", "table", "Output format: table or json")
	cmd.Flags().StringVar(&scopeType, "scope", "", "Scope type: global, repository, branch, or worktree")
	cmd.Flags().StringVar(&repoPath, "repo", "", "Repository path for repository/branch/worktree scopes")
	cmd.Flags().StringVar(&branchName, "branch", "", "Branch name (requires --scope branch)")
	cmd.Flags().StringVar(&worktreeID, "worktree", "", "Worktree id (requires --scope worktree)")

	return cmd
}

type infoOutputEntry struct {
	ID          int64   `json:"id"`
	ScopeID     int64   `json:"scopeId"`
	Scope       string  `json:"scope"`
	Key         string  `json:"key"`
	Version     int64   `json:"version"`
	FilePath    string  `json:"filePath"`
	Hash        string  `json:"hash"`
	Description *string `json:"description,omitempty"`
	CreatedAt   string  `json:"createdAt"`
	IsArchived  bool    `json:"isArchived"`
}

func outputInfoJSON(cmd *cobra.Command, result *usecase.GetResult) error {
	output := infoOutputEntry{
		ID:          result.Record.EntryID,
		ScopeID:     result.Record.ScopeID,
		Scope:       scope.FormatScope(result.Scope),
		Key:         result.Record.Key,
		Version:     result.Record.Version,
		FilePath:    result.Record.FilePath,
		Hash:        result.Record.Hash,
		Description: result.Record.Description,
		CreatedAt:   result.Record.CreatedAt.Format(time.RFC3339),
		IsArchived:  result.Record.IsArchived,
	}

	encoder := json.NewEncoder(cmd.OutOrStdout())
	encoder.SetIndent("", "  ")
	return encoder.Encode(output)
}

func outputInfoTable(cmd *cobra.Command, result *usecase.GetResult) error {
	// Key-value pair format for single entry
	fmt.Fprintf(cmd.OutOrStdout(), "ID:          %d\n", result.Record.EntryID)
	fmt.Fprintf(cmd.OutOrStdout(), "Scope ID:    %d\n", result.Record.ScopeID)
	fmt.Fprintf(cmd.OutOrStdout(), "Scope:       %s\n", scope.FormatScope(result.Scope))
	fmt.Fprintf(cmd.OutOrStdout(), "Key:         %s\n", result.Record.Key)
	fmt.Fprintf(cmd.OutOrStdout(), "Version:     %d\n", result.Record.Version)
	fmt.Fprintf(cmd.OutOrStdout(), "File Path:   %s\n", result.Record.FilePath)
	fmt.Fprintf(cmd.OutOrStdout(), "Hash:        %s\n", result.Record.Hash)

	if result.Record.Description != nil {
		fmt.Fprintf(cmd.OutOrStdout(), "Description: %s\n", *result.Record.Description)
	} else {
		fmt.Fprintf(cmd.OutOrStdout(), "Description: \n")
	}

	fmt.Fprintf(cmd.OutOrStdout(), "Created At:  %s\n", result.Record.CreatedAt.Format("2006-01-02 15:04:05"))
	fmt.Fprintf(cmd.OutOrStdout(), "Archived:    %t\n", result.Record.IsArchived)

	return nil
}
