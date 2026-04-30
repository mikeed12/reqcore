DO $$ BEGIN
  CREATE TYPE "public"."conversation_type" AS ENUM ('task', 'support', 'chat');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."conversation_status" AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."message_sender_type" AS ENUM ('candidate', 'admin', 'system');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"type" "conversation_type" NOT NULL DEFAULT 'chat',
	"title" text NOT NULL,
	"status" "conversation_status" NOT NULL DEFAULT 'open',
	"application_id" text,
	"metadata" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_type" "message_sender_type" NOT NULL,
	"sender_id" text,
	"sender_name" text NOT NULL,
	"content" text NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conversation" ADD CONSTRAINT "conversation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conversation" ADD CONSTRAINT "conversation_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conversation" ADD CONSTRAINT "conversation_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_organization_id_idx" ON "conversation" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_candidate_id_idx" ON "conversation" USING btree ("candidate_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_type_idx" ON "conversation" USING btree ("type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_status_idx" ON "conversation" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_updated_at_idx" ON "conversation" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_conversation_id_idx" ON "message" USING btree ("conversation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_created_at_idx" ON "message" USING btree ("created_at");
