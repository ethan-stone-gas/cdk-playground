import { telemetryServer } from "./telemetry-server";
import { log } from "./log";

const baseUrl = `http://${process.env.AWS_LAMBDA_RUNTIME_API}/2020-01-01/extension`;

async function register() {
  const res = await fetch(`${baseUrl}/register`, {
    method: "POST",
    body: JSON.stringify({
      events: ["INVOKE", "SHUTDOWN"],
    }),
    headers: {
      "Content-Type": "application/json",
      "Lambda-Extension-Name": "rate-limit-extension",
    },
  });

  if (!res.ok) {
    log("error", "register failed", {
      status: res.status,
      statusText: res.statusText,
      body: await res.text(),
    });
    return;
  }

  return res.headers.get("lambda-extension-identifier");
}

async function next(extensionId: string) {
  const res = await fetch(`${baseUrl}/event/next`, {
    method: "get",
    headers: {
      "Content-Type": "application/json",
      "Lambda-Extension-Identifier": extensionId,
    },
  });

  if (!res.ok) {
    log("error", "next failed", {
      status: res.status,
      statusText: res.statusText,
      body: await res.text(),
    });
    return null;
  }

  return await res.json();
}

async function error(extensionId: string, phase: string, err: Error) {
  const errorType = `Extension.${err.name || "UnknownError"}`;
  const res = await fetch(`${baseUrl}/${phase}/error`, {
    method: "post",
    body: JSON.stringify({
      errorMessage: err.message || `${err}`,
      errorType: errorType,
      stackTrace: [err.stack],
    }),
    headers: {
      "Content-Type": "application/json",
      "Lambda-Extension-Identifier": extensionId,
      "Lambda-Extension-Function-Error-Type": errorType,
    },
  });

  if (!res.ok) {
    console.error(`${phase} error failed`, await res.text());
    throw new AggregateError(
      [err, res.text()],
      `Failure reporting ${phase} error`
    );
  }

  throw err;
}

function handleShutdown(event: any) {
  log("info", "shutdown", { event });
  process.exit(0);
}

function handleInvoke(event: any) {
  log("info", "invoke", { event });
}

async function main() {
  log("info", "starting extension");

  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));

  log("info", "registering extension");

  const extensionId = await register();

  log("info", "extension registered", { extensionId });

  if (!extensionId) {
    throw new Error("Failed to register extension");
  }

  await telemetryServer(extensionId);

  while (true) {
    try {
      const event = await next(extensionId);
      log("info", "event", { event });
    } catch (err) {
      log("error", "error", { err });
      await error(extensionId, "next", err as Error);
    }
  }
}

main();
