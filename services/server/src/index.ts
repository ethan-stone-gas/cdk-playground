import Fastify from "fastify";
import formbody from "@fastify/formbody";
import websocket from "@fastify/websocket";
import twilio from "twilio";
import { retrieveSecret } from "./retrieve-secret.js";
import { randomUUID } from "crypto";
import alawmulaw from "alawmulaw";
import {
  S2SBidirectionalStreamClient,
  StreamSession,
} from "./nova-client-typesafe.js";
import { DefaultSystemPrompt } from "./consts.js";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

const fastify = Fastify({
  logger: true,
});

fastify.register(formbody);
fastify.register(websocket);

const bedrockClient = new S2SBidirectionalStreamClient({
  clientConfig: {
    region: "us-east-1",
    credentials: fromNodeProviderChain(),
  },
});
const sessionMap: Record<string, StreamSession> = {};

let twilioClient: twilio.Twilio;

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
    "https://cdk-playground-production.up.railway.app/incoming-call",
    request.body as Record<string, unknown>
  );

  const twiml = new twilio.twiml.VoiceResponse();

  twiml.connect().stream({
    name: "AI Agent Audio Stream",
    url: "wss://cdk-playground-production.up.railway.app/media-stream",
  });

  reply.type("text/xml");
  reply.send(twiml.toString());
});

fastify.register(async (fastify) => {
  fastify.get("/media-stream", { websocket: true }, async (connection, req) => {
    await validateTwilioWebhook(
      req.headers["x-twilio-signature"],
      `wss://cdk-playground-production.up.railway.app${req.originalUrl}`,
      {}
    );

    console.log("Media stream connected");

    const sessionId = randomUUID();
    const session: StreamSession = bedrockClient.createStreamSession(sessionId);
    sessionMap[sessionId] = session;
    bedrockClient.initiateSession(sessionId);

    let callSid = "";
    connection.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        //use streamSid as session id. little complicated in conference scenarios

        switch (data.event) {
          case "connected":
            console.log(`connected event ${message}`);
            await session.setupPromptStart();
            break;
          case "start":
            await session.setupSystemPrompt(undefined, DefaultSystemPrompt);
            await session.setupStartAudioContent();

            session.twilioStreamSid = data.streamSid;
            callSid = data.start.callSid; //call sid to update while redirecting it to SIP endpoint
            console.log(
              `Stream started streamSid: ${session.twilioStreamSid}, callSid: ${callSid}`
            );

            setTimeout(async () => {
              await session.sendTextContent("");
            }, 1000);
            break;

          case "media":
            if (!session.twilioStreamSid) break;
            //console.log(`Audio ${data.media.track} - sequence: ${data.sequenceNumber}`);
            //convert from 8-bit mulaw to 16-bit LPCM
            const audioInput = Buffer.from(data.media.payload, "base64");
            const pcmSamples = alawmulaw.mulaw.decode(audioInput);
            const audioBuffer = Buffer.from(pcmSamples.buffer);

            //send audio to nova client
            //const audioBuffer = data.media.payload;
            await session.streamAudioContent(audioBuffer);
            break;

          default:
            console.log("Received non-media event:", data.event);
            break;
        }
      } catch (error) {
        console.error("Error parsing message:", error, "Message:", message);
        connection.close();
      }
    });

    // Handle connection close
    connection.on("close", () => {
      console.log("Client disconnected.");
    });

    // Set up event handlers
    session.onEvent("contentStart", (data) => {
      console.log("contentStart:", data);
      //socket.emit('contentStart', data);
    });

    session.onEvent("textOutput", (data) => {
      console.log(
        "Text output:",
        data.event.textOutput.content.substring(0, 50) + "..."
      );
      //socket.emit('textOutput', data);
    });

    session.onEvent("audioOutput", (data) => {
      //console.log('Audio output received, sending to client');
      //socket.emit('audioOutput', data);
      //send the audio back to twilio
      //console.log('audioOutput')

      // Decode base64 to get the PCM buffer
      const buffer = Buffer.from(data.event.audioOutput.content, "base64");
      // Convert to Int16Array (your existing code is correct here)
      const pcmSamples = new Int16Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.length / Int16Array.BYTES_PER_ELEMENT
      );
      // Encode to mulaw (8-bit)
      const mulawSamples = alawmulaw.mulaw.encode(pcmSamples);
      // Convert to base64
      const payload = Buffer.from(mulawSamples).toString("base64");

      const audioResponse = {
        event: "media",
        media: {
          track: "outbound",
          payload,
        },
        streamSid: session.twilioStreamSid,
      };

      connection.send(JSON.stringify(audioResponse));
    });

    session.onEvent("error", (data) => {
      console.error("Error in session:", data);
      //socket.emit('error', data);
      //optionally close the connection based on the error
    });

    session.onEvent("toolUse", async (data) => {
      console.log("Tool use detected:", data.event.toolUse.toolName);
      //TODO: handle tool use
      //socket.emit('toolUse', data);
    });

    session.onEvent("contentEnd", (data) => {
      console.log("Content end received");
      //socket.emit('contentEnd', data);
    });

    session.onEvent("streamComplete", () => {
      console.log("Stream completed for client:", session.twilioStreamSid);
      //socket.emit('streamComplete');
    });
  });
});

// Start the server
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const host = process.env.HOST || "0.0.0.0";

    const secrets = await retrieveSecret(process.env.SECRET_ARN!, [
      "TWILIO_ACCOUNT_SID",
      "TWILIO_API_SID",
      "TWILIO_API_SECRET",
    ]);

    twilioClient = new twilio.Twilio(
      secrets.TWILIO_API_SID,
      secrets.TWILIO_API_SECRET,
      { accountSid: secrets.TWILIO_ACCOUNT_SID }
    );

    await fastify.listen({ port, host });
    console.log(`Server is running on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
