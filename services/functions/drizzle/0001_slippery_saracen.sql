CREATE TABLE "sync_checkpoints" (
	"job_name" text PRIMARY KEY NOT NULL,
	"last_synced_timestamp" timestamp NOT NULL
);
