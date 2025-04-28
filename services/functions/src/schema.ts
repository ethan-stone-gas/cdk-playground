import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const incidents = pgTable("incidents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status", { enum: ["OPEN", "RESOLVED"] }).notNull(),
  team: text("team"),
  createdAt: timestamp("created_at").notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export type Incident = typeof incidents.$inferSelect;

type TimelineEventData =
  | {
      type: "Incident Triggered";
      provider: "AWS Incident Manager";
      data: {
        triggerArn: string;
      };
    }
  | {
      type: "Incident Started";
      provider: "AWS Incident Manager";
      data: {
        triggerArn: string;
      };
    }
  | {
      type: "Contact Engaged";
      provider: "AWS Incident Manager";
      data: {
        contactArn: string;
        engagementArn: string;
      };
    }
  | {
      type: "Incident Acknowledged";
      provider: "AWS Incident Manager";
      data: {
        contactArn: string;
        engagementArn: string;
      };
    }
  | {
      type: "Incident Resolved";
      provider: "AWS Incident Manager";
    };

export const incidentTimelineEvents = pgTable(
  "incident_timeline_events",
  {
    id: text("id").primaryKey(),
    incidentId: text("incident_id").references(() => incidents.id),
    eventType: text("event_type", {
      enum: [
        "Incident Triggered",
        "Incident Started",
        "Contact Engaged",
        "Incident Acknowledged",
        "Incident Resolved",
      ],
    }).notNull(),
    eventData: jsonb("event_data").$type<TimelineEventData>().notNull(),
    timestamp: timestamp("timestamp").notNull(),
  },
  (table) => [
    index("incidents_timeline_events_incident_id_idx").on(table.incidentId),
    index("incidents_timeline_events_timestamp_idx").on(table.timestamp),
  ]
);

export type IncidentTimelineEvent = typeof incidentTimelineEvents.$inferSelect;

export const syncCheckpoints = pgTable("sync_checkpoints", {
  jobName: text("job_name", {
    enum: ["Incident Manager Sync"],
  }).primaryKey(),
  lastSyncedTimestamp: timestamp("last_synced_timestamp").notNull(),
});

export const contacts = pgTable("contacts", {
  id: text("id").primaryKey(),
  alias: text("alias").notNull(),
  displayName: text("display_name").notNull(),
});

export type Contact = typeof contacts.$inferSelect;
