import { Hono } from "hono";
import { streamHandle } from "hono/aws-lambda";
import { z } from "zod";
import { getEmbeddings, setApiKey } from "./ai-helpers";
import { getDb, insertContent } from "./db";
import { retrieveSecret } from "./retrieve-secret";

const app = new Hono();

const PostEmbeddingsBodySchema = z.object({
  input: z.string(),
});

app.post("/embeddings", async (c) => {
  const body = await c.req.json();

  const parsedBody = await PostEmbeddingsBodySchema.safeParseAsync(body);

  if (!parsedBody.success) {
    return c.json(
      {
        error: "Invalid request body",
      },
      400
    );
  }

  const secret = await retrieveSecret(process.env.SECRET_ARN!, [
    "GOOGLE_AI_API_KEY",
    "MONGO_URL",
  ]);

  setApiKey(secret.GOOGLE_AI_API_KEY);

  const embedding = await getEmbeddings({
    input: parsedBody.data.input,
  });

  const client = await getDb(secret.MONGO_URL);

  const db = client.db("ai");

  await insertContent(db, {
    text: parsedBody.data.input,
    embedding: embedding.embedding,
    createdAt: new Date(),
  });

  return c.json({
    data: {
      embedding: embedding.embedding,
    },
  });
});

export const main = streamHandle(app);
