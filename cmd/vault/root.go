package main

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "vault",
	Short: "vault.md - A knowledge vault for AI-assisted development",
	Long:  "vault.md stores versioned notes scoped to repositories, branches, and worktrees.",
}

func init() {
	rootCmd.AddCommand(newSetCmd())
	rootCmd.AddCommand(newGetCmd())
	rootCmd.AddCommand(newCatCmd())
	rootCmd.AddCommand(newListCmd())
}
