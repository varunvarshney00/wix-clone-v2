import Fastify, { type FastifyInstance } from "fastify";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { siteRoutes } from "./modules/sites/site.routes.js";
import { registerErrorHandler } from "./shared/error-handler.js";

export interface BuildAppOptions {
  logger?: boolean;
}

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
    
  const app = Fastify({
    logger: options.logger === false ? false : { level: config.logLevel },
  });

  registerErrorHandler(app);

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

  await app.register(siteRoutes, { prefix: "/api/v1" });

  return app;
}
