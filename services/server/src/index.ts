import Fastify from "fastify";

const fastify = Fastify({
  logger: true,
});

// Health check route
fastify.get("/health", async (request, reply) => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Root route
fastify.get("/", async (request, reply) => {
  return { message: "Hello from Fastify Server!", version: "1.0.0" };
});

// Example API route
fastify.get("/api/hello", async (request, reply) => {
  return {
    message: "Hello World!",
    timestamp: new Date().toISOString(),
    userAgent: request.headers["user-agent"],
  };
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
