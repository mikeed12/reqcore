CREATE TYPE "public"."mailbox_provider" AS ENUM('imap', 'gmail', 'microsoft');

CREATE TABLE "organization_mailbox" (
  "id"                      text PRIMARY KEY NOT NULL,
  "organization_id"         text NOT NULL,
  "label"                   text NOT NULL,
  "email"                   text NOT NULL,
  "provider"                "mailbox_provider" DEFAULT 'imap' NOT NULL,
  "imap_host"               text,
  "imap_port"               integer,
  "imap_tls"                boolean DEFAULT true,
  "smtp_host"               text,
  "smtp_port"               integer,
  "smtp_tls"                boolean DEFAULT true,
  "username_encrypted"      text,
  "password_encrypted"      text,
  "access_token_encrypted"  text,
  "refresh_token_encrypted" text,
  "token_expires_at"        timestamp with time zone,
  "is_active"               boolean DEFAULT true NOT NULL,
  "last_sync_at"            timestamp with time zone,
  "sync_error"              text,
  "created_at"              timestamp NOT NULL DEFAULT now(),
  "updated_at"              timestamp NOT NULL DEFAULT now()
);

CREATE TABLE "member_mailbox_assignment" (
  "id"                       text PRIMARY KEY NOT NULL,
  "organization_mailbox_id"  text NOT NULL,
  "user_id"                  text NOT NULL,
  "organization_id"          text NOT NULL,
  "is_primary"               boolean DEFAULT false NOT NULL,
  "assigned_at"              timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "organization_mailbox"
  ADD CONSTRAINT "organization_mailbox_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "member_mailbox_assignment"
  ADD CONSTRAINT "member_mailbox_assignment_organization_mailbox_id_fk"
  FOREIGN KEY ("organization_mailbox_id") REFERENCES "public"."organization_mailbox"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "member_mailbox_assignment"
  ADD CONSTRAINT "member_mailbox_assignment_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "member_mailbox_assignment"
  ADD CONSTRAINT "member_mailbox_assignment_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "org_mailbox_org_idx" ON "organization_mailbox" ("organization_id");
CREATE UNIQUE INDEX "org_mailbox_org_email_idx" ON "organization_mailbox" ("organization_id", "email");

CREATE UNIQUE INDEX "member_mailbox_assignment_unique_idx" ON "member_mailbox_assignment" ("user_id", "organization_mailbox_id");
CREATE INDEX "member_mailbox_assignment_user_org_idx" ON "member_mailbox_assignment" ("user_id", "organization_id");
CREATE INDEX "member_mailbox_assignment_mailbox_idx" ON "member_mailbox_assignment" ("organization_mailbox_id");
