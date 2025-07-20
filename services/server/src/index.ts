import Fastify from "fastify";
import formbody from "@fastify/formbody";
import twilio from "twilio";
import { retrieveSecret } from "./retrieve-secret.js";

const fastify = Fastify({
  logger: true,
});

fastify.register(formbody);

async function validateTwilioWebhook(
  signature: string | string[] | undefined,
  url: string,
  body: Record<string, unknown>
) {
  if (typeof signature !== "string") {
    throw new Error("Signature is not a string");
  }

  const secrets = await retrieveSecret(process.env.SECRET_ARN!, [
    "TWILIO_AUTH_TOKEN",
  ]);

  const valid = twilio.validateRequest(
    secrets.TWILIO_AUTH_TOKEN,
    signature,
    url,
    body
  );

  if (!valid) {
    throw new Error("Invalid signature");
  }
}

// Health check route
fastify.get("/health", async (request, reply) => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Root route
fastify.get("/", async (request, reply) => {
  return { message: "Hello from Fastify Server!", version: "1.0.0" };
});

fastify.post("/incoming-call", async (request, reply) => {
  await validateTwilioWebhook(
    request.headers["x-twilio-signature"],
    "https://nova.pebble.sh/incoming-call",
    request.body as Record<string, unknown>
  );

  const twiml = new twilio.twiml.VoiceResponse();

  twiml.say("Hello, this is a test call.");

  reply.type("text/xml");
  reply.send(twiml.toString());
});

// Start the server
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const host = process.env.HOST || "0.0.0.0";

    await fastify.listen({ port, host });
    console.log(`Server is running on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
