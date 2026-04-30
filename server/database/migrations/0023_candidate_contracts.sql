CREATE TYPE "public"."candidate_contract_type" AS ENUM('employment', 'freelance', 'consulting', 'service', 'nda', 'other');
--> statement-breakpoint
CREATE TABLE "candidate_contract" (
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
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "candidate_contract" ADD CONSTRAINT "candidate_contract_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "candidate_contract" ADD CONSTRAINT "candidate_contract_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "candidate_contract_candidate_id_idx" ON "candidate_contract" USING btree ("candidate_id");
--> statement-breakpoint
CREATE INDEX "candidate_contract_organization_id_idx" ON "candidate_contract" USING btree ("organization_id");
