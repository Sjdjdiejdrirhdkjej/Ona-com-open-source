CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "key_hash" text NOT NULL UNIQUE,
  "key_prefix" text NOT NULL,
  "scope" text NOT NULL DEFAULT 'task_running',
  "request_count" integer NOT NULL DEFAULT 0,
  "rate_limit_per_hour" integer NOT NULL DEFAULT 60,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_used_at" timestamp,
  "revoked_at" timestamp
);

CREATE TABLE IF NOT EXISTS "api_key_rate_limits" (
  "api_key_id" text PRIMARY KEY REFERENCES "api_keys"("id") ON DELETE CASCADE,
  "window_start" timestamp NOT NULL,
  "request_count" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
