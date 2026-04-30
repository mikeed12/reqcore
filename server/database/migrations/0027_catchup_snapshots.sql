-- Catchup migration: makes snapshots 0022-0026 available to drizzle-kit.
-- Every statement is idempotent — safe to run on DBs that already have these tables.
DO $$ BEGIN
  CREATE TYPE "public"."candidate_contract_type" AS ENUM('employment', 'freelance', 'consulting', 'service', 'nda', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."conversation_status" AS ENUM('open', 'closed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."conversation_type" AS ENUM('task', 'support', 'chat');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."mailbox_provider" AS ENUM('imap', 'gmail', 'microsoft');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."message_sender_type" AS ENUM('candidate', 'admin', 'system');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidate_contract" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"title" text NOT NULL,
	"employer_name" text NOT NULL,
	"contract_type" "candidate_contract_type" DEFAULT 'employment' NOT NULL,
	"start_date" text,
	"end_date" text,
	"salary" text,
	"currency" text DEFAULT 'USD',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"type" "conversation_type" DEFAULT 'chat' NOT NULL,
	"title" text NOT NULL,
	"status" "conversation_status" DEFAULT 'open' NOT NULL,
	"application_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mail_message" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_mailbox_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"uid" integer NOT NULL,
	"folder" text DEFAULT 'INBOX' NOT NULL,
	"message_id" text,
	"from_name" text,
	"from_email" text,
	"to_json" text,
	"cc_json" text,
	"subject" text,
	"body_text" text,
	"body_html" text,
	"sent_at" timestamp with time zone,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_mailbox_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_mailbox_id" text NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_sip_extension_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_sip_extension_id" text NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
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
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_mailbox" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"label" text NOT NULL,
	"email" text NOT NULL,
	"provider" "mailbox_provider" DEFAULT 'imap' NOT NULL,
	"imap_host" text,
	"imap_port" integer,
	"imap_tls" boolean DEFAULT true,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_tls" boolean DEFAULT true,
	"username_encrypted" text,
	"password_encrypted" text,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp with time zone,
	"sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_sip_extension" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"label" text NOT NULL,
	"extension" text NOT NULL,
	"display_name" text,
	"username_encrypted" text,
	"password_encrypted" text,
	"domain" text,
	"ws_port" text DEFAULT '8089',
	"ws_path" text DEFAULT '/ws',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "candidate_contract" ADD CONSTRAINT "candidate_contract_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "candidate_contract" ADD CONSTRAINT "candidate_contract_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
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
  ALTER TABLE "mail_message" ADD CONSTRAINT "mail_message_organization_mailbox_id_organization_mailbox_id_fk" FOREIGN KEY ("organization_mailbox_id") REFERENCES "public"."organization_mailbox"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mail_message" ADD CONSTRAINT "mail_message_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "member_mailbox_assignment" ADD CONSTRAINT "member_mailbox_assignment_organization_mailbox_id_organization_mailbox_id_fk" FOREIGN KEY ("organization_mailbox_id") REFERENCES "public"."organization_mailbox"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "member_mailbox_assignment" ADD CONSTRAINT "member_mailbox_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "member_mailbox_assignment" ADD CONSTRAINT "member_mailbox_assignment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "member_sip_extension_assignment" ADD CONSTRAINT "member_sip_extension_assignment_organization_sip_extension_id_organization_sip_extension_id_fk" FOREIGN KEY ("organization_sip_extension_id") REFERENCES "public"."organization_sip_extension"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "member_sip_extension_assignment" ADD CONSTRAINT "member_sip_extension_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "member_sip_extension_assignment" ADD CONSTRAINT "member_sip_extension_assignment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "organization_mailbox" ADD CONSTRAINT "organization_mailbox_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "organization_sip_extension" ADD CONSTRAINT "organization_sip_extension_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "candidate_contract_candidate_id_idx" ON "candidate_contract" USING btree ("candidate_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "candidate_contract_organization_id_idx" ON "candidate_contract" USING btree ("organization_id");
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
CREATE INDEX IF NOT EXISTS "mail_message_mailbox_idx" ON "mail_message" USING btree ("organization_mailbox_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_message_org_idx" ON "mail_message" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mail_message_uid_folder_idx" ON "mail_message" USING btree ("organization_mailbox_id","folder","uid");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_mailbox_assignment_unique_idx" ON "member_mailbox_assignment" USING btree ("user_id","organization_mailbox_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_mailbox_assignment_user_org_idx" ON "member_mailbox_assignment" USING btree ("user_id","organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_mailbox_assignment_mailbox_idx" ON "member_mailbox_assignment" USING btree ("organization_mailbox_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_sip_ext_assignment_unique_idx" ON "member_sip_extension_assignment" USING btree ("user_id","organization_sip_extension_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_sip_ext_assignment_user_org_idx" ON "member_sip_extension_assignment" USING btree ("user_id","organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_sip_ext_assignment_ext_idx" ON "member_sip_extension_assignment" USING btree ("organization_sip_extension_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_conversation_id_idx" ON "message" USING btree ("conversation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_created_at_idx" ON "message" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_mailbox_org_idx" ON "organization_mailbox" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_mailbox_org_email_idx" ON "organization_mailbox" USING btree ("organization_id","email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_sip_ext_org_idx" ON "organization_sip_extension" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_sip_ext_org_ext_idx" ON "organization_sip_extension" USING btree ("organization_id","extension");
