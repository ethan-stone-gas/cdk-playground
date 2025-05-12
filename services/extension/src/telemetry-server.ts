import { createServer } from "http";
import { log } from "./log";
import { z } from "zod";

const baseUrl = `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2022-07-01/telemetry`;

const RequestMessageSchema = z.object({
  entityId: z.string(),
  windowIdentifier: z.string(),
  timestamp: z.number(),
});

const BodySchema = z.array(
  z.object({
    time: z.string(),
    type: z.literal("function"),
    record: z.string(),
  })
);

export const telemetryServer = async (extensionId: string) => {
  const server = createServer((req, res) => {
    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        log("info", "telemetry", { body });

        try {
          const parsedBody = BodySchema.parse(JSON.parse(body));

          parsedBody.forEach((record) => {
            try {
              const splitRecord = record.record.split("\t");

              if (splitRecord.length !== 4) {
                return;
              }

              const [_time, _requestId, _level, message] = splitRecord;

              const parsedMessage = RequestMessageSchema.parse(
                JSON.parse(message.replaceAll("\n", ""))
              );

              console.log(parsedMessage);
            } catch (error) {
              return;
            }
          });

          res.writeHead(200);
          res.end("OK");
        } catch (error) {
          res.writeHead(200);
          res.end("OK");
        }
      });
    } else {
      console.error("Unexpected request", { method: req.method, url: req.url });
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(4243, "sandbox");

  const res = await fetch(`${baseUrl}`, {
    method: "PUT",
    body: JSON.stringify({
      schemaVersion: "2022-12-13",
      types: ["function"],
      buffering: {
        maxBytes: 1024 * 1024,
        maxItems: 1000,
        timeoutMs: 1000,
      },
      destination: {
        protocol: "HTTP",
        URI: `http://sandbox.localdomain:4243`,
      },
    }),
    headers: {
      "Content-Type": "application/json",
      "Lambda-Extension-Identifier": extensionId,
    },
  });

  if (!res.ok) {
    log("error", "Failed to register telemetry server", {
      status: res.status,
      statusText: res.statusText,
      body: await res.text(),
    });
    return;
  }

  log("info", "Telemetry server listening at http://sandbox:4243");
  return;
};
