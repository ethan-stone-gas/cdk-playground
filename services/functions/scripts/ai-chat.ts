import dotenv from "dotenv";
import { getEmbeddings, setApiKey } from "src/ai-helpers";
import { getDb, searchContent } from "src/db";

dotenv.config();

async function main() {
  const apiKey = process.env.GOOGLE_AI_API_KEY!;
  const url = process.env.MONGO_URL!;

  const client = await getDb(url);

  const db = client.db("ai");

  setApiKey(apiKey);

  const searchPhrase = "What is the most common issue when starting a charge?";

  const embedding = await getEmbeddings({
    input: searchPhrase,
  });

  const result = await searchContent(db, embedding.embedding);

  console.log(result);

  await client.close();
}

main();
