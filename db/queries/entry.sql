-- name: FindEntryByID :one
SELECT id, scope_id, key, created_at
FROM entries
WHERE id = ?
LIMIT 1;

-- name: FindEntryByScopeAndKey :one
SELECT id, scope_id, key, created_at
FROM entries
WHERE scope_id = ? AND key = ?
LIMIT 1;

-- name: ListEntriesByScope :many
SELECT id, scope_id, key, created_at
FROM entries
WHERE scope_id = ?
ORDER BY id;

-- name: InsertEntry :execresult
INSERT INTO entries (scope_id, key)
VALUES (?, ?);

-- name: DeleteEntryByID :execrows
DELETE FROM entries
WHERE id = ?;

-- name: DeleteEntriesByScope :execrows
DELETE FROM entries
WHERE scope_id = ?;
