CREATE TABLE "organization_sip_extension" (
  "id"                   text PRIMARY KEY NOT NULL,
  "organization_id"      text NOT NULL,
  "label"                text NOT NULL,
  "extension"            text NOT NULL,
  "display_name"         text,
  "username_encrypted"   text,
  "password_encrypted"   text,
  "domain"               text,
  "ws_port"              text DEFAULT '8089',
  "ws_path"              text DEFAULT '/ws',
  "is_active"            boolean DEFAULT true NOT NULL,
  "created_at"           timestamp NOT NULL DEFAULT now(),
  "updated_at"           timestamp NOT NULL DEFAULT now()
);

CREATE TABLE "member_sip_extension_assignment" (
  "id"                           text PRIMARY KEY NOT NULL,
  "organization_sip_extension_id" text NOT NULL,
  "user_id"                      text NOT NULL,
  "organization_id"              text NOT NULL,
  "is_primary"                   boolean DEFAULT false NOT NULL,
  "assigned_at"                  timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "organization_sip_extension"
  ADD CONSTRAINT "organization_sip_extension_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "member_sip_extension_assignment"
  ADD CONSTRAINT "member_sip_extension_assignment_extension_id_fk"
  FOREIGN KEY ("organization_sip_extension_id") REFERENCES "public"."organization_sip_extension"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "member_sip_extension_assignment"
  ADD CONSTRAINT "member_sip_extension_assignment_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "member_sip_extension_assignment"
  ADD CONSTRAINT "member_sip_extension_assignment_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "org_sip_ext_org_idx" ON "organization_sip_extension" ("organization_id");
CREATE UNIQUE INDEX "org_sip_ext_org_ext_idx" ON "organization_sip_extension" ("organization_id", "extension");

CREATE UNIQUE INDEX "member_sip_ext_assignment_unique_idx" ON "member_sip_extension_assignment" ("user_id", "organization_sip_extension_id");
CREATE INDEX "member_sip_ext_assignment_user_org_idx" ON "member_sip_extension_assignment" ("user_id", "organization_id");
CREATE INDEX "member_sip_ext_assignment_ext_idx" ON "member_sip_extension_assignment" ("organization_sip_extension_id");
