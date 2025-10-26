-- name: FindEntryStatusByEntryID :one
SELECT entry_id, is_archived, current_version, updated_at
FROM entry_status
WHERE entry_id = ?
LIMIT 1;

-- name: InsertEntryStatus :exec
INSERT INTO entry_status (entry_id, is_archived, current_version)
VALUES (?, ?, ?);

-- name: UpdateEntryStatusCurrentVersion :exec
UPDATE entry_status
SET current_version = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE entry_id = ?;

-- name: UpdateEntryStatusArchived :execrows
UPDATE entry_status
SET is_archived = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE entry_id = ?;

-- name: DeleteEntryStatus :execrows
DELETE FROM entry_status
WHERE entry_id = ?;
