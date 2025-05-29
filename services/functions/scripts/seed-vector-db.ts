import dotenv from "dotenv";
import { getEmbeddings, setApiKey } from "src/ai-helpers";
import { getDb, insertContent } from "src/db";
import { listConversations, listTickets, setCredentials } from "src/zoho";

dotenv.config();

async function main() {
  const url = process.env.MONGO_URL!;
  const apiKey = process.env.GOOGLE_AI_API_KEY!;

  setApiKey(apiKey);

  const client = await getDb(url);

  const db = client.db("ai");

  setCredentials(
    process.env.ZOHO_CLIENT_ID!,
    process.env.ZOHO_CLIENT_SECRET!,
    process.env.ZOHO_REFRESH_TOKEN!,
    process.env.ZOHO_ORG_ID!
  );

  const tickets = await listTickets({
    departmentIds: ["711061000000241157"],
  });

  for (const ticket of tickets.data) {
    const conversations = await listConversations({
      ticketId: ticket.id,
    });

    for (const conversation of conversations.data) {
      console.log(
        `[${new Date().toISOString()}] Processing conversation ${
          conversation.id
        }`
      );

      const summary = conversation.summary;
      const content = conversation.content;

      const embedding = await getEmbeddings({
        input: `Summary: ${summary}\nContent: ${content}`,
      });

      await insertContent(db, {
        text: `Summary: ${summary}\nContent: ${content}`,
        embedding: embedding.embedding,
        createdAt: new Date(),
      });

      // only make 5 requests per minute, make it 70 seconds to give some buffer
      await new Promise((resolve) => setTimeout(resolve, 70000 / 5));
    }
  }

  await client.close();
}

main();
