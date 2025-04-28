import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | undefined = undefined;
let db: NodePgDatabase<typeof schema> | undefined = undefined;

export async function getDb(url: string) {
  if (db) return db;

  if (!pool) {
    pool = new Pool({
      connectionString: url,
    });
  }

  db = drizzle(pool, { schema });

  return db;
}
