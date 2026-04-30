CREATE TABLE "mail_message" (
  "id"                       text PRIMARY KEY NOT NULL,
  "organization_mailbox_id"  text NOT NULL,
  "organization_id"          text NOT NULL,
  "uid"                      integer NOT NULL,
  "folder"                   text DEFAULT 'INBOX' NOT NULL,
  "message_id"               text,
  "from_name"                text,
  "from_email"               text,
  "to_json"                  text,
  "cc_json"                  text,
  "subject"                  text,
  "body_text"                text,
  "body_html"                text,
  "sent_at"                  timestamp with time zone,
  "is_read"                  boolean DEFAULT false NOT NULL,
  "is_flagged"               boolean DEFAULT false NOT NULL,
  "synced_at"                timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "mail_message"
  ADD CONSTRAINT "mail_message_organization_mailbox_id_fk"
  FOREIGN KEY ("organization_mailbox_id") REFERENCES "public"."organization_mailbox"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "mail_message"
  ADD CONSTRAINT "mail_message_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "mail_message_mailbox_idx" ON "mail_message" ("organization_mailbox_id");
CREATE INDEX "mail_message_org_idx" ON "mail_message" ("organization_id");
CREATE UNIQUE INDEX "mail_message_uid_folder_idx" ON "mail_message" ("organization_mailbox_id", "folder", "uid");
