import type { FastifyInstance } from "fastify";
import * as controller from "./site.controller.js";

export async function siteRoutes(app: FastifyInstance): Promise<void> {
  app.post("/sites", controller.createSiteHandler);
  app.get("/sites", controller.listSitesHandler);
  app.get("/sites/:id", controller.getSiteHandler);
}
