CREATE TABLE "incident_timeline_events" (
	"id" text PRIMARY KEY NOT NULL,
	"incident_id" text,
	"event_type" text NOT NULL,
	"event_data" jsonb NOT NULL,
	"timestamp" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "incident_timeline_events" ADD CONSTRAINT "incident_timeline_events_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;