package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jedib0t/go-pretty/v6/table"
	"github.com/spf13/cobra"

	"github.com/choplin/vault.md/internal/database"
	"github.com/choplin/vault.md/internal/scope"
	"github.com/choplin/vault.md/internal/usecase"
)

func newListCmd() *cobra.Command {
	var (
		allVersions     bool
		includeArchived bool
		format          string
		scopeType       string
		repoPath        string
		branchName      string
		worktreeID      string
	)

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List keys in vault",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			sc, err := scope.ResolveScope(scope.ScopeOptions{
				Type:     scopeType,
				Repo:     repoPath,
				Branch:   branchName,
				Worktree: worktreeID,
			})
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
			uc := usecase.NewEntry(dbCtx)

			useAllScopes := scopeType == "" && repoPath == "" && branchName == "" && worktreeID == ""

			var opts *usecase.ListOptions
			if includeArchived || allVersions || useAllScopes {
				opts = &usecase.ListOptions{
					IncludeArchived: includeArchived,
					AllVersions:     allVersions,
					AllScopes:       useAllScopes,
				}
			}

			result, err := uc.List(ctx, sc, opts)
			if err != nil {
				return err
			}

			switch format {
			case "json":
				return outputJSON(cmd, result)
			case "table":
				return outputTable(cmd, result, includeArchived)
			default:
				return fmt.Errorf("invalid format: %s (valid values: table, json)", format)
			}
		},
	}

	cmd.Flags().BoolVar(&allVersions, "all-versions", false, "Show all versions")
	cmd.Flags().BoolVar(&includeArchived, "include-archived", false, "Include archived entries")
	cmd.Flags().StringVar(&format, "format", "table", "Output format: table or json")
	cmd.Flags().StringVar(&scopeType, "scope", "", "Scope type: global, repository, branch, or worktree")
	cmd.Flags().StringVar(&repoPath, "repo", "", "List from specific repository")
	cmd.Flags().StringVar(&branchName, "branch", "", "List from specific branch")
	cmd.Flags().StringVar(&worktreeID, "worktree", "", "List from specific worktree")

	return cmd
}

type listOutputEntry struct {
	Scope       string  `json:"scope"`
	ScopeType   string  `json:"scope_type"`
	Key         string  `json:"key"`
	Version     int64   `json:"version"`
	Created     string  `json:"created"`
	Description *string `json:"description,omitempty"`
	Archived    *bool   `json:"archived,omitempty"`
}

func outputJSON(cmd *cobra.Command, result *usecase.ListResult) error {
	var output []listOutputEntry

	for _, entry := range result.Entries {
		item := listOutputEntry{
			Scope:       entry.ScopeShort,
			ScopeType:   string(entry.ScopeType),
			Key:         entry.Record.Key,
			Version:     entry.Record.Version,
			Created:     entry.Record.CreatedAt.Format(time.RFC3339),
			Description: entry.Record.Description,
		}
		if entry.Record.IsArchived {
			archived := true
			item.Archived = &archived
		}
		output = append(output, item)
	}

	encoder := json.NewEncoder(cmd.OutOrStdout())
	encoder.SetIndent("", "  ")
	return encoder.Encode(output)
}

func outputTable(cmd *cobra.Command, result *usecase.ListResult, includeArchived bool) error {
	t := table.NewWriter()
	t.SetOutputMirror(cmd.OutOrStdout())
	t.SetStyle(table.StyleLight)

	// Set header
	if includeArchived {
		t.AppendHeader(table.Row{"Scope", "Scope Type", "Key", "Version", "Created", "Description", "Archived"})
	} else {
		t.AppendHeader(table.Row{"Scope", "Scope Type", "Key", "Version", "Created", "Description"})
	}

	// Add rows
	for _, entry := range result.Entries {
		created := entry.Record.CreatedAt.Format("2006-01-02 15:04:05")
		description := ""
		if entry.Record.Description != nil {
			description = *entry.Record.Description
		}

		if includeArchived {
			archived := "false"
			if entry.Record.IsArchived {
				archived = "true"
			}
			t.AppendRow(table.Row{
				entry.ScopeShort,
				entry.ScopeType,
				entry.Record.Key,
				entry.Record.Version,
				created,
				description,
				archived,
			})
		} else {
			t.AppendRow(table.Row{
				entry.ScopeShort,
				entry.ScopeType,
				entry.Record.Key,
				entry.Record.Version,
				created,
				description,
			})
		}
	}

	t.Render()
	return nil
}
