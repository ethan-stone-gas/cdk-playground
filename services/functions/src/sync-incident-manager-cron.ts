import { ScheduledHandler } from "aws-lambda";
import {
  EventSummary,
  GetIncidentRecordCommand,
  GetTimelineEventCommand,
  IncidentRecord,
  IncidentRecordSummary,
  ListIncidentRecordsCommand,
  ListTagsForResourceCommand,
  ListTimelineEventsCommand,
  ListTimelineEventsCommandOutput,
  SSMIncidentsClient,
  TimelineEvent,
} from "@aws-sdk/client-ssm-incidents";
import {
  ListContactsCommand,
  SSMContactsClient,
} from "@aws-sdk/client-ssm-contacts";
import { getSecret } from "./secret-manager";
import { getDb } from "./db";
import * as schema from "./schema";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";

const ssmIncidentsClient = new SSMIncidentsClient({
  region: "us-east-1",
});

const ssmContactsClient = new SSMContactsClient({
  region: "us-east-1",
});

export const main: ScheduledHandler = async (event) => {
  console.log("Starting Incident Manager sync process");

  const now = new Date();

  const secret = await getSecret(process.env.DB_SECRET_ARN!, [
    "password",
    "dbname",
    "engine",
    "port",
    "dbInstanceIdentifier",
    "host",
    "username",
  ]);
  console.log("Successfully retrieved database credentials");

  const url = `postgres://${secret.username}:${secret.password}@${secret.host}:${secret.port}/${secret.dbname}?sslmode=no-verify`;

  const db = await getDb(url);
  console.log("Successfully connected to database");

  const checkpoint = await db.query.syncCheckpoints.findFirst({
    where: (table, { eq }) => eq(table.jobName, "Incident Manager Sync"),
  });

  const lastSyncedTimestamp = checkpoint?.lastSyncedTimestamp ?? new Date(0);

  console.log(`Last sync timestamp: ${lastSyncedTimestamp.toISOString()}`);

  // Stage 1: Get all PERSONAL contacts from AWS SSM Contacts
  console.log("Fetching contacts from AWS SSM Contacts...");
  const awsContacts: { id: string; alias: string; displayName: string }[] = [];
  let nextContactToken: string | undefined;

  while (true) {
    const contactsResponse = await ssmContactsClient.send(
      new ListContactsCommand({
        NextToken: nextContactToken,
      })
    );

    if (!contactsResponse.Contacts) {
      console.log("No contacts found in SSM Contacts");
      break;
    }

    console.log(
      `Found ${contactsResponse.Contacts.length} contacts in current batch`
    );

    for (const contact of contactsResponse.Contacts) {
      if (contact.Type === "PERSONAL") {
        awsContacts.push({
          id: contact.ContactArn!,
          alias: contact.Alias!,
          displayName: contact.DisplayName!,
        });
      }
    }

    if (!contactsResponse.NextToken) {
      console.log("Finished fetching all contacts from AWS");
      break;
    }

    nextContactToken = contactsResponse.NextToken;
  }

  // Stage 2: Get all contacts from database
  console.log("Fetching contacts from database...");
  const dbContacts = await db.query.contacts.findMany();
  console.log(`Found ${dbContacts.length} contacts in database`);

  // Stage 3: Upsert AWS contacts into database
  console.log("Upserting AWS contacts into database...");
  for (const contact of awsContacts) {
    console.log(`Upserting contact: ${contact.id}`);
    await db
      .insert(schema.contacts)
      .values({
        id: contact.id,
        alias: contact.alias,
        displayName: contact.displayName,
      })
      .onConflictDoUpdate({
        target: [schema.contacts.id],
        set: {
          alias: contact.alias,
          displayName: contact.displayName,
        },
      });
  }

  // Stage 4: Delete contacts that are only in database
  console.log("Checking for contacts to delete...");
  const awsContactIds = new Set(awsContacts.map((c) => c.id));
  const contactsToDelete = dbContacts.filter((c) => !awsContactIds.has(c.id));

  if (contactsToDelete.length > 0) {
    console.log(`Found ${contactsToDelete.length} contacts to delete`);
    for (const contact of contactsToDelete) {
      console.log(`Deleting contact: ${contact.id}`);
      await db
        .delete(schema.contacts)
        .where(eq(schema.contacts.id, contact.id));
    }
  } else {
    console.log("No contacts to delete");
  }

  /**
   * 1. Get all incidents that were created in the last hour.
   * 2. Sync the incidents and timeline events with DB.
   * 3. Loop through incidents in DB that are OPEN.
   * 4. Sync the incidents and timeline events with DB.
   */

  let incidentIdsToSync: string[] = [];

  let nextIncidentToken: string | undefined;

  console.log("Fetching incidents from SSM Incident Manager...");

  while (true) {
    const incidentsResponse = await ssmIncidentsClient.send(
      new ListIncidentRecordsCommand({
        filters: [
          {
            key: "creationTime",
            condition: {
              after: lastSyncedTimestamp,
            },
          },
        ],
        maxResults: 100,
        nextToken: nextIncidentToken,
      })
    );

    if (!incidentsResponse.incidentRecordSummaries) {
      console.log("No incidents found in SSM Incident Manager");
      break;
    }

    console.log(
      `Found ${incidentsResponse.incidentRecordSummaries.length} incidents in current batch`
    );

    for (const incident of incidentsResponse.incidentRecordSummaries) {
      if (
        incident.creationTime &&
        incident.creationTime > lastSyncedTimestamp &&
        incident.arn
      ) {
        incidentIdsToSync.push(incident.arn);
      }
    }

    if (!incidentsResponse.nextToken) {
      console.log("Finished fetching all incidents");
      break;
    }

    nextIncidentToken = incidentsResponse.nextToken;
  }

  const dbIncidents = await db.query.incidents.findMany({
    where: (table, { eq }) => eq(table.status, "OPEN"),
  });
  console.log(`Found ${dbIncidents.length} open incidents in database`);

  const dbIncidentIds = dbIncidents.map((incident) => incident.id);

  incidentIdsToSync = incidentIdsToSync.concat(dbIncidentIds);
  console.log(`Total incidents to sync: ${incidentIdsToSync.length}`);

  for (const incidentId of incidentIdsToSync) {
    console.log(`Syncing incident: ${incidentId}`);
    await syncIncident(db, incidentId);
  }

  await db
    .insert(schema.syncCheckpoints)
    .values({
      jobName: "Incident Manager Sync",
      lastSyncedTimestamp: now,
    })
    .onConflictDoUpdate({
      target: [schema.syncCheckpoints.jobName],
      set: {
        lastSyncedTimestamp: now,
      },
    });

  console.log("Completed syncing all incidents");
};

async function syncIncident(
  db: NodePgDatabase<typeof schema>,
  incidentId: string
) {
  console.log(`Fetching details for incident: ${incidentId}`);

  const incident = await ssmIncidentsClient.send(
    new GetIncidentRecordCommand({
      arn: incidentId,
    })
  );

  if (!incident.incidentRecord) {
    console.error(`Incident not found: ${incidentId}`);
    throw new Error("Incident not found");
  }

  const tags = await ssmIncidentsClient.send(
    new ListTagsForResourceCommand({
      resourceArn: incidentId,
    })
  );

  const team = tags.tags?.["lynkwell:team"];

  console.log(`Updating incident record in database: ${incidentId}`);

  await db
    .insert(schema.incidents)
    .values({
      id: incident.incidentRecord.arn!,
      name: incident.incidentRecord.title!,
      status: incident.incidentRecord.status!,
      team: team ?? null,
      impact: getImpactFromIncidentRecord(incident.incidentRecord),
      createdAt: incident.incidentRecord.creationTime!,
      resolvedAt: incident.incidentRecord.resolvedTime!,
    })
    .onConflictDoUpdate({
      target: [schema.incidents.id],
      set: {
        status: incident.incidentRecord.status,
        team,
        name: incident.incidentRecord.title,
        impact: getImpactFromIncidentRecord(incident.incidentRecord),
        createdAt: incident.incidentRecord.creationTime!,
        resolvedAt: incident.incidentRecord.resolvedTime!,
      },
    });

  const allTimelineEvents: EventSummary[] = [];

  let nextToken: string | undefined = undefined;

  console.log(`Fetching timeline events for incident: ${incidentId}`);
  while (true) {
    const timelineEventsResponse: ListTimelineEventsCommandOutput =
      await ssmIncidentsClient.send(
        new ListTimelineEventsCommand({
          incidentRecordArn: incidentId,
          nextToken,
        })
      );

    if (!timelineEventsResponse.eventSummaries) {
      console.log(`No timeline events found for incident: ${incidentId}`);
      break;
    }

    console.log(
      `Found ${timelineEventsResponse.eventSummaries.length} timeline events in current batch`
    );
    for (const event of timelineEventsResponse.eventSummaries) {
      allTimelineEvents.push(event);
    }

    if (!timelineEventsResponse.nextToken) {
      console.log("Finished fetching all timeline events");
      break;
    }

    nextToken = timelineEventsResponse.nextToken;
  }

  console.log(
    `Processing ${allTimelineEvents.length} timeline events for incident: ${incidentId}`
  );

  for (const event of allTimelineEvents) {
    console.log(`Fetching details for timeline event: ${event.eventId}`);
    const timelineEvent = await ssmIncidentsClient.send(
      new GetTimelineEventCommand({
        eventId: event.eventId!,
        incidentRecordArn: incidentId,
      })
    );

    if (!timelineEvent.event) {
      console.log(`Timeline event not found: ${event.eventId}`);
      continue;
    }

    if (!isEventTypeOfInterest(timelineEvent.event.eventType!)) {
      console.log(
        `Skipping uninteresting event type: ${timelineEvent.event.eventType}`
      );
      continue;
    }

    const eventType = timelineEvent.event.eventType! as TimelineEventType;
    console.log(`Processing event type: ${eventType}`);

    if (eventType === "SSM Incident Record Update") {
      const eventData = JSON.parse(
        timelineEvent.event.eventData!
      ) as TimelineEventData["SSM Incident Record Update"];

      for (const attribute of eventData.modifiedAttributes!) {
        if (attribute.attributeName === "status") {
          if (attribute.newValue === "RESOLVED") {
            console.log(
              `Adding resolution event to timeline: ${event.eventId}`
            );
            await db
              .insert(schema.incidentTimelineEvents)
              .values({
                id: event.eventId!,
                incidentId,
                eventType: "Incident Resolved",
                eventData: {
                  type: "Incident Resolved",
                  provider: "AWS Incident Manager",
                },
                timestamp: timelineEvent.event.eventTime!,
              })
              .onConflictDoUpdate({
                target: [schema.incidentTimelineEvents.id],
                set: {
                  eventType: "Incident Resolved",
                  incidentId,
                  eventData: {
                    type: "Incident Resolved",
                    provider: "AWS Incident Manager",
                  },
                  timestamp: timelineEvent.event.eventTime!,
                },
              });
          }
        }
      }
    }

    if (eventType === "SSM Incident Start") {
      console.log(`Processing incident start event: ${event.eventId}`);
      const eventData = JSON.parse(
        timelineEvent.event.eventData!
      ) as TimelineEventData["SSM Incident Start"];

      console.log(`Adding start event to timeline: ${event.eventId}`);
      await db
        .insert(schema.incidentTimelineEvents)
        .values({
          id: event.eventId!,
          incidentId,
          eventType: "Incident Started",
          eventData: {
            type: "Incident Started",
            provider: "AWS Incident Manager",
            data: {
              triggerArn: eventData.triggerArn,
            },
          },
          timestamp: timelineEvent.event.eventTime!,
        })
        .onConflictDoUpdate({
          target: [schema.incidentTimelineEvents.id],
          set: {
            eventType: "Incident Started",
            incidentId,
            eventData: {
              type: "Incident Started",
              provider: "AWS Incident Manager",
              data: {
                triggerArn: eventData.triggerArn,
              },
            },
            timestamp: timelineEvent.event.eventTime!,
          },
        });
    }

    if (eventType === "SSM Contacts Page Acknowledgement for Incident") {
      const eventData = JSON.parse(
        timelineEvent.event.eventData!
      ) as TimelineEventData["SSM Contacts Page Acknowledgement for Incident"];

      await db
        .insert(schema.incidentTimelineEvents)
        .values({
          id: event.eventId!,
          incidentId,
          eventType: "Incident Acknowledged",
          eventData: {
            type: "Incident Acknowledged",
            provider: "AWS Incident Manager",
            data: {
              contactArn: eventData.contactArn,
              engagementArn: eventData.engagementArn,
            },
          },
          timestamp: timelineEvent.event.eventTime!,
        })
        .onConflictDoUpdate({
          target: [schema.incidentTimelineEvents.id],
          set: {
            eventType: "Incident Acknowledged",
            incidentId,
            eventData: {
              type: "Incident Acknowledged",
              provider: "AWS Incident Manager",
              data: {
                contactArn: eventData.contactArn,
                engagementArn: eventData.engagementArn,
              },
            },
            timestamp: timelineEvent.event.eventTime!,
          },
        });
    }

    if (eventType === "SSM Contacts Page for Incident") {
      const eventData = JSON.parse(
        timelineEvent.event.eventData!
      ) as TimelineEventData["SSM Contacts Page for Incident"];

      await db
        .insert(schema.incidentTimelineEvents)
        .values({
          id: event.eventId!,
          incidentId,
          eventType: "Contact Engaged",
          eventData: {
            type: "Contact Engaged",
            provider: "AWS Incident Manager",
            data: {
              contactArn: eventData.contactArn,
              engagementArn: eventData.engagementArn,
            },
          },
          timestamp: timelineEvent.event.eventTime!,
        })
        .onConflictDoUpdate({
          target: [schema.incidentTimelineEvents.id],
          set: {
            eventType: "Contact Engaged",
            incidentId,
            eventData: {
              type: "Contact Engaged",
              provider: "AWS Incident Manager",
              data: {
                contactArn: eventData.contactArn,
                engagementArn: eventData.engagementArn,
              },
            },
            timestamp: timelineEvent.event.eventTime!,
          },
        });
    }

    if (eventType === "SSM Incident Trigger") {
      const eventData = JSON.parse(
        timelineEvent.event.eventData!
      ) as TimelineEventData["SSM Incident Trigger"];

      await db
        .insert(schema.incidentTimelineEvents)
        .values({
          id: event.eventId!,
          incidentId,
          eventType: "Incident Triggered",
          eventData: {
            type: "Incident Triggered",
            provider: "AWS Incident Manager",
            data: {
              triggerArn: eventData.triggerArn,
            },
          },
          timestamp: timelineEvent.event.eventTime!,
        })
        .onConflictDoUpdate({
          target: [schema.incidentTimelineEvents.id],
          set: {
            eventType: "Incident Triggered",
            incidentId,
            eventData: {
              type: "Incident Triggered",
              provider: "AWS Incident Manager",
              data: {
                triggerArn: eventData.triggerArn,
              },
            },
            timestamp: timelineEvent.event.eventTime!,
          },
        });
    }
  }

  console.log(`Completed processing incident: ${incidentId}`);
}

function isEventTypeOfInterest(eventType: string): boolean {
  if (eventType === "SSM Contacts Page Acknowledgement for Incident") {
    return true;
  }

  if (eventType === "SSM Contacts Page for Incident") {
    return true;
  }

  if (eventType === "SSM Incident Record Update") {
    return true;
  }

  if (eventType === "SSM Incident Start") {
    return true;
  }

  if (eventType === "SSM Incident Trigger") {
    return true;
  }

  return false;
}

type TimelineEventData = {
  "SSM Incident Trigger": {
    createdIncident: boolean;
    incidentSource: string;
    triggerArn: string;
    rawData: string;
  };
  "SSM Incident Record Update": {
    modifiedBy: string;
    modifiedAttributes: {
      attributeName: string;
      newValue: string;
    }[];
    incidentTitle: string;
  };
  "SSM Incident Start": {
    incidentTitle: string;
    contactsEngage: {
      contactArn: string;
      contactName: string;
    }[];
    ssmDocumentName: string;
    ssmDocumentVersion: string;
    triggerArn: string;
  };
  "SSM Contacts Page Acknowledgement for Incident": {
    contactArn: string;
    engagementArn: string;
  };
  "SSM Contacts Page for Incident": {
    contactArn: string;
    engagementArn: string;
  };
};

type TimelineEventType = keyof TimelineEventData;

function getImpactFromIncidentRecord(
  incidentRecord: IncidentRecord
): schema.Incident["impact"] {
  if (incidentRecord.impact === 1) {
    return "CRITICAL";
  }

  if (incidentRecord.impact === 2) {
    return "HIGH";
  }

  if (incidentRecord.impact === 3) {
    return "MEDIUM";
  }

  if (incidentRecord.impact === 4) {
    return "LOW";
  }

  return "NO IMPACT";
}
