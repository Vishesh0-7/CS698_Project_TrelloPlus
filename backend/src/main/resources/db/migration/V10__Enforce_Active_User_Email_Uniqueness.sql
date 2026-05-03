-- Ensure production data keeps one active account per email address.
-- V1 already creates a unique users.email constraint for fresh databases; this
-- defensive index protects databases that were created before that constraint
-- or restored with weaker local/dev schema settings.
WITH ranked_active_users AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY LOWER(email)
            ORDER BY created_at DESC, id DESC
        ) AS duplicate_rank
    FROM users
    WHERE is_deletion_marked IS NOT TRUE
)
UPDATE users
SET
    is_deletion_marked = true,
    deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP)
WHERE id IN (
    SELECT id
    FROM ranked_active_users
    WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_active_email_unique
ON users (LOWER(email))
WHERE is_deletion_marked IS NOT TRUE;
