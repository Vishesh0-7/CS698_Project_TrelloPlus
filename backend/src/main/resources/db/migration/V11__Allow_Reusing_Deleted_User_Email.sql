-- Soft-deleted users keep their historical email, but active users must still
-- have unique emails. Replace the global unique constraint with a partial
-- unique index that only applies to non-deleted accounts.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

DROP INDEX IF EXISTS idx_users_active_email_unique;
DROP INDEX IF EXISTS idx_users_email;

CREATE UNIQUE INDEX idx_users_active_email_unique
ON users (LOWER(email))
WHERE is_deletion_marked = false OR is_deletion_marked IS NULL;

CREATE INDEX idx_users_email
ON users (email);
