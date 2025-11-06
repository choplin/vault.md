package main

import (
	"os"
)

// version is set via ldflags during build
var version = "dev"

func main() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
