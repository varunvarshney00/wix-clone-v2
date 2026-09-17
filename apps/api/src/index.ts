import Fastify from "fastify";
import { config } from "./config.js";
import { pool, verifyConnection, closePool } from "./db/pool.js";

import { siteRoutes } from "./modules/sites/site.routes.js";
import { registerErrorHandler } from "./shared/error-handler.js";

const app = Fastify({
  logger: {
    level: config.logLevel,
  },
});

app.get("/health", async () => {
  return { status: "ok" };
});

app.get("/ready", async (request, reply) => {
  try {
    await pool.query("SELECT 1");
    return { status: "ready", database: "up" };
  } catch (error) {
    request.log.error(error, "readiness check failed");
    return reply.code(503).send({ status: "not_ready", database: "down" });
  }
});

registerErrorHandler(app);

await app.register(siteRoutes, { prefix: "/api/v1" });

const SHUTDOWN_TIMEOUT_MS = 10_000;

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    app.log.warn(`received ${signal} during shutdown, ignoring`);
    return;
  }

  shuttingDown = true;
  app.log.info(`received ${signal}, starting graceful shutdown`);

  const forceExit = setTimeout(() => {
    app.log.error("shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    await app.close();
    app.log.info("http server closed");

    await closePool();
    app.log.info("database pool closed");

    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    app.log.error(error, "error during shutdown");
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await verifyConnection();
  app.log.info("database connection verified");

  await app.listen({ port: config.port, host: config.host });
  app.log.info(`environment: ${config.nodeEnv}`);
} catch (error) {
  app.log.error(error);
  await closePool();
  process.exit(1);
}