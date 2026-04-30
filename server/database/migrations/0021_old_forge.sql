CREATE TABLE "address" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"street" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip" text NOT NULL,
	"country" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "address_application_organization_id_idx" ON "address" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "address_application_candidate_id_idx" ON "address" USING btree ("candidate_id");
