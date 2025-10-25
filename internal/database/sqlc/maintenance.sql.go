package sqldb

import "context"

const deleteAllVersions = `DELETE FROM versions`

func (q *Queries) DeleteAllVersions(ctx context.Context) error {
	_, err := q.db.ExecContext(ctx, deleteAllVersions)
	return err
}

const deleteAllEntryStatus = `DELETE FROM entry_status`

func (q *Queries) DeleteAllEntryStatus(ctx context.Context) error {
	_, err := q.db.ExecContext(ctx, deleteAllEntryStatus)
	return err
}

const deleteAllEntries = `DELETE FROM entries`

func (q *Queries) DeleteAllEntries(ctx context.Context) error {
	_, err := q.db.ExecContext(ctx, deleteAllEntries)
	return err
}

const deleteAllScopes = `DELETE FROM scopes`

func (q *Queries) DeleteAllScopes(ctx context.Context) error {
	_, err := q.db.ExecContext(ctx, deleteAllScopes)
	return err
}
