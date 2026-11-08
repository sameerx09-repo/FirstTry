CREATE TABLE IF NOT EXISTS api_tokens(id text PRIMARY KEY,token_hash text UNIQUE NOT NULL,user_id text NOT NULL REFERENCES users(id),name text NOT NULL,scope text NOT NULL CHECK(scope IN ('cli','deploy')),expires_at bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),last_used_at timestamptz);
CREATE INDEX IF NOT EXISTS api_tokens_user ON api_tokens(user_id);
CREATE TABLE IF NOT EXISTS device_codes(device_hash text PRIMARY KEY,user_code text UNIQUE NOT NULL,expires_at bigint NOT NULL,user_id text REFERENCES users(id),approved boolean NOT NULL DEFAULT false);
