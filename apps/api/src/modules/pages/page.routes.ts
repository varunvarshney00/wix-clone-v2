import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../../shared/auth-hook.js";
import * as controller from "./page.controller.js";

export async function pageRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);

  app.post(
    "/sites/:siteId/pages",
    { preHandler: requireRole("editor") },
    controller.createPageHandler,
  );

  app.get("/sites/:siteId/pages", controller.listPagesHandler);

  app.get("/sites/:siteId/pages/:pageId", controller.getPageHandler);

  app.patch(
    "/sites/:siteId/pages/:pageId",
    { preHandler: requireRole("editor") },
    controller.updatePageHandler,
  );
  
  app.delete(
    "/sites/:siteId/pages/:pageId",
    { preHandler: requireRole("admin") },
    controller.deletePageHandler,
  );
}
