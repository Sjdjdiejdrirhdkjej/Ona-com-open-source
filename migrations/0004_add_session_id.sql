ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "session_id" text;
CREATE INDEX IF NOT EXISTS "conversations_session_id_idx" ON "conversations" ("session_id");
