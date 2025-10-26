-- name: FindVersionByID :one
SELECT id, entry_id, version, file_path, hash, description, created_at
FROM versions
WHERE id = ?
LIMIT 1;

-- name: FindVersionByEntryAndVersion :one
SELECT id, entry_id, version, file_path, hash, description, created_at
FROM versions
WHERE entry_id = ? AND version = ?
LIMIT 1;

-- name: ListVersionsByEntry :many
SELECT id, entry_id, version, file_path, hash, description, created_at
FROM versions
WHERE entry_id = ?
ORDER BY version DESC;

-- name: MaxVersionForEntry :one
SELECT CAST(COALESCE(MAX(version), 0) AS INTEGER) AS max_version
FROM versions
WHERE entry_id = ?;

-- name: InsertVersion :execresult
INSERT INTO versions (entry_id, version, file_path, hash, description)
VALUES (?, ?, ?, ?, ?);

-- name: DeleteVersionByID :execrows
DELETE FROM versions
WHERE id = ?;

-- name: DeleteVersionByEntryAndVersion :execrows
DELETE FROM versions
WHERE entry_id = ? AND version = ?;

-- name: DeleteVersionsByEntry :execrows
DELETE FROM versions
WHERE entry_id = ?;

-- name: CountVersionsByEntry :one
SELECT COUNT(*) AS count
FROM versions
WHERE entry_id = ?;
