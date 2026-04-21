CREATE TABLE IF NOT EXISTS "codebase_memory" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "confidence" INTEGER NOT NULL DEFAULT 1,
  "source_conversation_id" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "codebase_memory_user_key_idx" ON "codebase_memory" ("user_id", "key");
