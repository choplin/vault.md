package main

import (
	"context"
	"log"

	"github.com/spf13/cobra"

	"github.com/choplin/vault.md/internal/mcp"
)

func newMCPCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "mcp",
		Short: "Start MCP server",
		Long:  "Start the Model Context Protocol server for vault.md",
		RunE: func(cmd *cobra.Command, args []string) error {
			server, err := mcp.NewServer()
			if err != nil {
				log.Fatalf("Failed to create MCP server: %v", err)
			}

			ctx := context.Background()
			return server.Run(ctx)
		},
	}

	return cmd
}
