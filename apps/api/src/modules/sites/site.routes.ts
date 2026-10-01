import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../../shared/auth-hook.js";
import * as controller from "./site.controller.js";

export async function siteRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);

  app.post("/sites", { preHandler: requireRole("editor") }, controller.createSiteHandler);
  app.get("/sites", controller.listSitesHandler);
  app.get("/sites/:id", controller.getSiteHandler);
}