ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "user_id" text;
CREATE INDEX IF NOT EXISTS "conversations_user_id_idx" ON "conversations" ("user_id");
