package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/jedib0t/go-pretty/v6/table"
	"github.com/mattn/go-runewidth"
	"github.com/spf13/cobra"
	"golang.org/x/term"

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
		RunE: func(cmd *cobra.Command, _ []string) error {
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
				outputTable(cmd, result, includeArchived)
				return nil
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

func getTerminalWidth() int {
	// Try to get terminal width from stdout
	if width, _, err := term.GetSize(int(os.Stdout.Fd())); err == nil && width > 0 {
		return width
	}
	// Default width if terminal size cannot be determined
	return 80
}

// wrapString wraps a string to fit within maxWidth, accounting for multi-byte characters
func wrapString(s string, maxWidth int) string {
	if maxWidth <= 0 {
		return s
	}

	s = strings.TrimSpace(s)
	if runewidth.StringWidth(s) <= maxWidth {
		return s
	}

	var result strings.Builder
	var currentLine strings.Builder
	currentWidth := 0

	for _, r := range s {
		charWidth := runewidth.RuneWidth(r)

		// Check if adding this character would exceed maxWidth
		if currentWidth+charWidth > maxWidth {
			// If current line is not empty, start a new line
			if currentWidth > 0 {
				result.WriteString(currentLine.String())
				result.WriteString("\n")
				currentLine.Reset()
				currentWidth = 0
			}
		}

		// Add the character to the current line
		currentLine.WriteRune(r)
		currentWidth += charWidth
	}

	// Add any remaining content
	if currentLine.Len() > 0 {
		result.WriteString(currentLine.String())
	}

	return result.String()
}

// columnWidths holds the calculated widths for each column
type columnWidths struct {
	scope          int
	scopeType      int
	key            int
	version        int
	versionHeader  string
	created        int
	useShortDate   bool
	description    int
	archived       int
	archivedHeader string
}

// calculateColumnWidths determines optimal column widths based on terminal width and data
func calculateColumnWidths(termWidth int, entries []usecase.ListEntry, includeArchived bool) columnWidths {
	numColumns := 6
	if includeArchived {
		numColumns = 7
	}

	// Reserve space for table borders and padding (roughly 3 chars per column)
	borderPadding := numColumns * 3
	availableWidth := termWidth - borderPadding

	// Calculate actual maximum widths needed for Scope and Key from data
	// These columns are highest priority and should display in single lines
	maxScopeWidth := 0
	maxKeyWidth := 0
	for _, entry := range entries {
		scopeLen := runewidth.StringWidth(entry.ScopeShort)
		if scopeLen > maxScopeWidth {
			maxScopeWidth = scopeLen
		}
		keyLen := runewidth.StringWidth(entry.Record.Key)
		if keyLen > maxKeyWidth {
			maxKeyWidth = keyLen
		}
	}

	// ScopeType is predictable: "repository" is the longest at 10 chars
	scopeTypeWidth := 10

	// Set widths based on actual data
	scopeWidth := maxScopeWidth
	if scopeWidth < 10 {
		scopeWidth = 10
	}
	// Only cap at very high values to prevent extremely long entries from breaking layout
	if scopeWidth > 60 {
		scopeWidth = 60
	}

	keyWidth := maxKeyWidth
	if keyWidth < 10 {
		keyWidth = 10
	}
	// Only cap at very high values to prevent extremely long entries from breaking layout
	if keyWidth > 60 {
		keyWidth = 60
	}

	// Calculate initial description width with full format for version and date
	versionWidth := 7  // "Version"
	createdWidth := 19 // "2006-01-02 15:04:05"
	archivedWidth := 8 // "ARCHIVED"
	if includeArchived && availableWidth < 80 {
		archivedWidth = 6 // "Arch"
	}

	priorityWidth := availableWidth - versionWidth - createdWidth - scopeTypeWidth
	if includeArchived {
		priorityWidth -= archivedWidth
	}
	descWidth := priorityWidth - scopeWidth - keyWidth
	if descWidth > 20 {
		descWidth -= 3 // Account for table padding/borders
	}

	// If description width is too narrow, use abbreviated format for version and date
	versionHeader := "Version"
	useShortDate := false
	if descWidth < 20 {
		versionWidth = 5 // "Ver"
		versionHeader = "Ver"
		createdWidth = 11 // "01-02 15:04"
		useShortDate = true

		// Recalculate description width with abbreviated format
		priorityWidth = availableWidth - versionWidth - createdWidth - scopeTypeWidth
		if includeArchived {
			priorityWidth -= archivedWidth
		}
		descWidth = priorityWidth - scopeWidth - keyWidth
		if descWidth > 20 {
			descWidth -= 3
		}
	}

	if descWidth < 15 {
		descWidth = 15
	}

	archivedHeader := "Archived"
	if includeArchived && availableWidth < 80 {
		archivedHeader = "Arch"
	}

	return columnWidths{
		scope:          scopeWidth,
		scopeType:      scopeTypeWidth,
		key:            keyWidth,
		version:        versionWidth,
		versionHeader:  versionHeader,
		created:        createdWidth,
		useShortDate:   useShortDate,
		description:    descWidth,
		archived:       archivedWidth,
		archivedHeader: archivedHeader,
	}
}

func outputTable(cmd *cobra.Command, result *usecase.ListResult, includeArchived bool) {
	t := table.NewWriter()
	t.SetOutputMirror(cmd.OutOrStdout())
	t.SetStyle(table.StyleLight)

	// Get terminal width and calculate column widths
	termWidth := getTerminalWidth()
	widths := calculateColumnWidths(termWidth, result.Entries, includeArchived)

	// Note: We don't set WidthMax on columns because we're manually
	// wrapping/truncating the content before adding it to the table.
	// go-pretty's WidthMax doesn't handle multi-byte characters correctly.

	// Set header
	if includeArchived {
		t.AppendHeader(table.Row{"Scope", "Scope Type", "Key", widths.versionHeader, "Created", "Description", widths.archivedHeader})
	} else {
		t.AppendHeader(table.Row{"Scope", "Scope Type", "Key", widths.versionHeader, "Created", "Description"})
	}

	// Add rows with appropriate formatting
	// - Scope, Key: Width calculated from actual data (single line display)
	// - ScopeType: Fixed width
	// - Description: Truncate with ellipsis
	// - Created: Format adjusted based on description width
	for _, entry := range result.Entries {
		// Format date based on description width
		var created string
		if widths.useShortDate {
			// Short format: MM-DD HH:MM (no seconds)
			created = entry.Record.CreatedAt.Format("01-02 15:04")
		} else {
			// Full format: YYYY-MM-DD HH:MM:SS
			created = entry.Record.CreatedAt.Format("2006-01-02 15:04:05")
		}

		description := ""
		if entry.Record.Description != nil {
			description = *entry.Record.Description
		}

		// Format columns - widths are calculated from actual data to ensure single-line display
		// Use wrapString which will not wrap if content fits within the calculated width
		scopeFormatted := wrapString(entry.ScopeShort, widths.scope)
		scopeTypeFormatted := wrapString(string(entry.ScopeType), widths.scopeType)
		keyFormatted := wrapString(entry.Record.Key, widths.key)

		// Truncate description with ellipsis if too long
		descTruncated := runewidth.Truncate(description, widths.description, "...")

		if includeArchived {
			archived := "false"
			if entry.Record.IsArchived {
				archived = "true"
			}
			t.AppendRow(table.Row{
				scopeFormatted,
				scopeTypeFormatted,
				keyFormatted,
				entry.Record.Version,
				created,
				descTruncated,
				archived,
			})
		} else {
			t.AppendRow(table.Row{
				scopeFormatted,
				scopeTypeFormatted,
				keyFormatted,
				entry.Record.Version,
				created,
				descTruncated,
			})
		}
	}

	t.Render()
}
