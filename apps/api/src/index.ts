import Fastify from "fastify";
import { config } from "./config.js";

// this creates our fastify server instance
const app = Fastify({
  logger: { level: config.logLevel },
});

app.get("/health", async () => {
  return { status: "ok" };
});

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`environment: ${config.nodeEnv}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
