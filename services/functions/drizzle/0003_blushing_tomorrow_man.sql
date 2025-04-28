ALTER TABLE "incidents" ADD COLUMN "team" text;--> statement-breakpoint
CREATE INDEX "incidents_timeline_events_incident_id_idx" ON "incident_timeline_events" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incidents_timeline_events_timestamp_idx" ON "incident_timeline_events" USING btree ("timestamp");