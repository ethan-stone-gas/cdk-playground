import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config({
  path: ".env",
});

console.log("DATABASE_URL", process.env.DATABASE_URL);

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
