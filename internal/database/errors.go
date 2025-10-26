package database

import "errors"

// ErrNotFound indicates a requested record does not exist.
var ErrNotFound = errors.New("database: not found")
