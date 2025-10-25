package migrations

import "embed"

// Files exposes the compiled-in migration SQL files.
//
//go:embed *.sql
var Files embed.FS
