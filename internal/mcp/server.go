package mcp

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/vault-md/vaultmd/internal/database"
	"github.com/vault-md/vaultmd/internal/scope"
	"github.com/vault-md/vaultmd/internal/usecase"
)

// Server wraps the MCP server with vault-specific functionality
type Server struct {
	server *mcp.Server
	dbCtx  *database.Context
}

// NewServer creates a new MCP server instance
func NewServer() (*Server, error) {
	dbCtx, err := database.CreateDatabase("")
	if err != nil {
		return nil, fmt.Errorf("failed to create database: %w", err)
	}

	mcpServer := mcp.NewServer(&mcp.Implementation{
		Name:    "vault.md",
		Version: "0.1.0",
	}, nil)

	s := &Server{
		server: mcpServer,
		dbCtx:  dbCtx,
	}

	// Register tools
	s.registerTools()

	return s, nil
}

// Run starts the MCP server with stdio transport
func (s *Server) Run(ctx context.Context) error {
	defer database.CloseDatabase(s.dbCtx)
	return s.server.Run(ctx, &mcp.StdioTransport{})
}

func (s *Server) registerTools() {
	// vault_set
	mcp.AddTool(s.server, &mcp.Tool{
		Name:        "vault_set",
		Description: "Store content in the vault with a key",
	}, s.handleSet)

	// vault_get
	mcp.AddTool(s.server, &mcp.Tool{
		Name:        "vault_get",
		Description: "Retrieve content from the vault by key",
	}, s.handleGet)

	// vault_list
	mcp.AddTool(s.server, &mcp.Tool{
		Name:        "vault_list",
		Description: "List all entries in the vault",
	}, s.handleList)

	// vault_delete
	mcp.AddTool(s.server, &mcp.Tool{
		Name:        "vault_delete",
		Description: "Delete an entry from the vault",
	}, s.handleDelete)

	// vault_info
	mcp.AddTool(s.server, &mcp.Tool{
		Name:        "vault_info",
		Description: "Get metadata about a vault entry",
	}, s.handleInfo)
}

// Input/Output types for each tool

type SetInput struct {
	Key         string  `json:"key" jsonschema:"required,description=The key for the vault entry"`
	Content     string  `json:"content" jsonschema:"required,description=The content to store"`
	Description *string `json:"description,omitempty" jsonschema:"description=Optional description for the entry"`
	Scope       *string `json:"scope,omitempty" jsonschema:"enum=global;repository;branch;worktree,description=Scope type"`
	Repo        *string `json:"repo,omitempty" jsonschema:"description=Repository path"`
	Branch      *string `json:"branch,omitempty" jsonschema:"description=Branch name (for branch scope)"`
	Worktree    *string `json:"worktree,omitempty" jsonschema:"description=Worktree ID (for worktree scope)"`
	WorkingDir  *string `json:"workingDir,omitempty" jsonschema:"description=Working directory for git detection"`
}

type SetOutput struct {
	Message string `json:"message"`
	Path    string `json:"path"`
}

type GetInput struct {
	Key        string  `json:"key" jsonschema:"required,description=The key for the vault entry"`
	Version    *int    `json:"version,omitempty" jsonschema:"description=Specific version to retrieve (latest if not specified)"`
	Scope      *string `json:"scope,omitempty" jsonschema:"enum=global;repository;branch;worktree,description=Scope type"`
	Repo       *string `json:"repo,omitempty" jsonschema:"description=Repository path"`
	Branch     *string `json:"branch,omitempty" jsonschema:"description=Branch name (for branch scope)"`
	Worktree   *string `json:"worktree,omitempty" jsonschema:"description=Worktree ID (for worktree scope)"`
	WorkingDir *string `json:"workingDir,omitempty" jsonschema:"description=Working directory for git detection"`
}

type GetOutput struct {
	Content string `json:"content"`
}

type ListInput struct {
	AllVersions     *bool   `json:"allVersions,omitempty" jsonschema:"description=Include all versions, not just latest"`
	IncludeArchived *bool   `json:"includeArchived,omitempty" jsonschema:"description=Include archived entries"`
	Scope           *string `json:"scope,omitempty" jsonschema:"enum=global;repository;branch;worktree,description=Scope type"`
	Repo            *string `json:"repo,omitempty" jsonschema:"description=Repository path"`
	Branch          *string `json:"branch,omitempty" jsonschema:"description=Branch name (for branch scope)"`
	Worktree        *string `json:"worktree,omitempty" jsonschema:"description=Worktree ID (for worktree scope)"`
	WorkingDir      *string `json:"workingDir,omitempty" jsonschema:"description=Working directory for git detection"`
}

type ListOutput struct {
	Entries []ListEntry `json:"entries"`
}

type ListEntry struct {
	Key         string  `json:"key"`
	Version     int64   `json:"version"`
	Scope       string  `json:"scope"`
	Description *string `json:"description,omitempty"`
	CreatedAt   string  `json:"createdAt"`
	IsArchived  bool    `json:"isArchived,omitempty"`
}

type DeleteInput struct {
	Key        string  `json:"key" jsonschema:"required,description=The key for the vault entry to delete"`
	Version    *int    `json:"version,omitempty" jsonschema:"description=Specific version to delete (all versions if not specified)"`
	Scope      *string `json:"scope,omitempty" jsonschema:"enum=global;repository;branch;worktree,description=Scope type"`
	Repo       *string `json:"repo,omitempty" jsonschema:"description=Repository path"`
	Branch     *string `json:"branch,omitempty" jsonschema:"description=Branch name (for branch scope)"`
	Worktree   *string `json:"worktree,omitempty" jsonschema:"description=Worktree ID (for worktree scope)"`
	WorkingDir *string `json:"workingDir,omitempty" jsonschema:"description=Working directory for git detection"`
}

type DeleteOutput struct {
	Message string `json:"message"`
	Count   int    `json:"count,omitempty"`
}

type InfoInput struct {
	Key        string  `json:"key" jsonschema:"required,description=The key for the vault entry"`
	Version    *int    `json:"version,omitempty" jsonschema:"description=Specific version (latest if not specified)"`
	Scope      *string `json:"scope,omitempty" jsonschema:"enum=global;repository;branch;worktree,description=Scope type"`
	Repo       *string `json:"repo,omitempty" jsonschema:"description=Repository path"`
	Branch     *string `json:"branch,omitempty" jsonschema:"description=Branch name (for branch scope)"`
	Worktree   *string `json:"worktree,omitempty" jsonschema:"description=Worktree ID (for worktree scope)"`
	WorkingDir *string `json:"workingDir,omitempty" jsonschema:"description=Working directory for git detection"`
}

type InfoOutput struct {
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

// Helper function to resolve scope from input parameters
func resolveScopeFromInput(scopeType, repo, branch, worktree, workingDir *string) (scope.Scope, error) {
	opts := scope.ScopeOptions{}
	if scopeType != nil {
		opts.Type = *scopeType
	}
	if repo != nil {
		opts.Repo = *repo
	}
	if branch != nil {
		opts.Branch = *branch
	}
	if worktree != nil {
		opts.Worktree = *worktree
	}
	if workingDir != nil {
		opts.WorkingDir = *workingDir
	}

	return scope.ResolveScope(opts)
}

// Tool handlers

func (s *Server) handleSet(ctx context.Context, req *mcp.CallToolRequest, input SetInput) (*mcp.CallToolResult, SetOutput, error) {
	sc, err := resolveScopeFromInput(input.Scope, input.Repo, input.Branch, input.Worktree, input.WorkingDir)
	if err != nil {
		return nil, SetOutput{}, fmt.Errorf("failed to resolve scope: %w", err)
	}

	uc := usecase.NewEntry(s.dbCtx)
	var opts *usecase.SetOptions
	if input.Description != nil {
		opts = &usecase.SetOptions{
			Description: input.Description,
		}
	}

	path, err := uc.Set(ctx, sc, input.Key, input.Content, opts)
	if err != nil {
		return nil, SetOutput{}, fmt.Errorf("failed to set entry: %w", err)
	}

	return nil, SetOutput{
		Message: "Stored content successfully",
		Path:    path,
	}, nil
}

func (s *Server) handleGet(ctx context.Context, req *mcp.CallToolRequest, input GetInput) (*mcp.CallToolResult, GetOutput, error) {
	sc, err := resolveScopeFromInput(input.Scope, input.Repo, input.Branch, input.Worktree, input.WorkingDir)
	if err != nil {
		return nil, GetOutput{}, fmt.Errorf("failed to resolve scope: %w", err)
	}

	uc := usecase.NewEntry(s.dbCtx)
	var opts *usecase.GetOptions
	if input.Version != nil {
		opts = &usecase.GetOptions{
			Version: input.Version,
		}
	}

	result, err := uc.Get(ctx, sc, input.Key, opts)
	if err != nil {
		return nil, GetOutput{}, fmt.Errorf("failed to get entry: %w", err)
	}
	if result == nil {
		return nil, GetOutput{}, fmt.Errorf("entry not found: %s", input.Key)
	}

	content, err := os.ReadFile(result.Record.FilePath)
	if err != nil {
		return nil, GetOutput{}, fmt.Errorf("failed to read file: %w", err)
	}

	return nil, GetOutput{
		Content: string(content),
	}, nil
}

func (s *Server) handleList(ctx context.Context, req *mcp.CallToolRequest, input ListInput) (*mcp.CallToolResult, ListOutput, error) {
	sc, err := resolveScopeFromInput(input.Scope, input.Repo, input.Branch, input.Worktree, input.WorkingDir)
	if err != nil {
		return nil, ListOutput{}, fmt.Errorf("failed to resolve scope: %w", err)
	}

	uc := usecase.NewEntry(s.dbCtx)
	opts := &usecase.ListOptions{}
	if input.AllVersions != nil {
		opts.AllVersions = *input.AllVersions
	}
	if input.IncludeArchived != nil {
		opts.IncludeArchived = *input.IncludeArchived
	}

	result, err := uc.List(ctx, sc, opts)
	if err != nil {
		return nil, ListOutput{}, fmt.Errorf("failed to list entries: %w", err)
	}

	entries := make([]ListEntry, 0, len(result.Entries))
	for _, e := range result.Entries {
		entries = append(entries, ListEntry{
			Key:         e.Record.Key,
			Version:     e.Record.Version,
			Scope:       scope.FormatScope(e.Scope),
			Description: e.Record.Description,
			CreatedAt:   e.Record.CreatedAt.Format(time.RFC3339),
			IsArchived:  e.Record.IsArchived,
		})
	}

	return nil, ListOutput{
		Entries: entries,
	}, nil
}

func (s *Server) handleDelete(ctx context.Context, req *mcp.CallToolRequest, input DeleteInput) (*mcp.CallToolResult, DeleteOutput, error) {
	sc, err := resolveScopeFromInput(input.Scope, input.Repo, input.Branch, input.Worktree, input.WorkingDir)
	if err != nil {
		return nil, DeleteOutput{}, fmt.Errorf("failed to resolve scope: %w", err)
	}

	uc := usecase.NewEntry(s.dbCtx)

	if input.Version != nil {
		// Delete specific version
		deleted, err := uc.DeleteVersion(ctx, sc, input.Key, *input.Version)
		if err != nil {
			return nil, DeleteOutput{}, fmt.Errorf("failed to delete version: %w", err)
		}
		if !deleted {
			return nil, DeleteOutput{}, fmt.Errorf("version %d of key '%s' not found", *input.Version, input.Key)
		}
		return nil, DeleteOutput{
			Message: fmt.Sprintf("Deleted version %d of key '%s'", *input.Version, input.Key),
			Count:   1,
		}, nil
	}

	// Delete all versions
	count, err := uc.DeleteKey(ctx, sc, input.Key)
	if err != nil {
		return nil, DeleteOutput{}, fmt.Errorf("failed to delete key: %w", err)
	}
	if count == 0 {
		return nil, DeleteOutput{}, fmt.Errorf("key '%s' not found", input.Key)
	}

	return nil, DeleteOutput{
		Message: fmt.Sprintf("Deleted %d version(s) of key '%s'", count, input.Key),
		Count:   count,
	}, nil
}

func (s *Server) handleInfo(ctx context.Context, req *mcp.CallToolRequest, input InfoInput) (*mcp.CallToolResult, InfoOutput, error) {
	sc, err := resolveScopeFromInput(input.Scope, input.Repo, input.Branch, input.Worktree, input.WorkingDir)
	if err != nil {
		return nil, InfoOutput{}, fmt.Errorf("failed to resolve scope: %w", err)
	}

	uc := usecase.NewEntry(s.dbCtx)
	var opts *usecase.GetOptions
	if input.Version != nil {
		opts = &usecase.GetOptions{
			Version: input.Version,
		}
	}

	result, err := uc.Get(ctx, sc, input.Key, opts)
	if err != nil {
		return nil, InfoOutput{}, fmt.Errorf("failed to get entry info: %w", err)
	}
	if result == nil {
		return nil, InfoOutput{}, fmt.Errorf("entry not found: %s", input.Key)
	}

	return nil, InfoOutput{
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
	}, nil
}
