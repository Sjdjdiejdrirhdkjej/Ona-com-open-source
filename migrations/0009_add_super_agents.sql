CREATE TABLE IF NOT EXISTS "conversation_super_agents" (
	"conversation_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"heartbeat_minutes" integer DEFAULT 15 NOT NULL,
	"wake_prompt" text NOT NULL,
	"model" text DEFAULT 'ona-hands-off' NOT NULL,
	"next_heartbeat_at" timestamp,
	"last_heartbeat_at" timestamp,
	"last_run_status" text DEFAULT 'idle' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_super_agents" ADD CONSTRAINT "conversation_super_agents_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
