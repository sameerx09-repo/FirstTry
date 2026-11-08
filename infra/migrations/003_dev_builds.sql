ALTER TABLE versions ADD COLUMN IF NOT EXISTS dev boolean NOT NULL DEFAULT false;
ALTER TABLE versions DROP CONSTRAINT IF EXISTS versions_app_id_semver_key;
CREATE UNIQUE INDEX IF NOT EXISTS versions_release_semver ON versions(app_id,semver) WHERE dev=false;
CREATE INDEX IF NOT EXISTS versions_dev_latest ON versions(app_id,created_at) WHERE dev=true;
