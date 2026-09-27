import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../shared/auth-hook.js";
import * as controller from "./auth.controller.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register", controller.registerHandler);
  app.post("/auth/login", controller.loginHandler);
  app.post("/auth/refresh", controller.refreshHandler);
  app.post("/auth/logout", controller.logoutHandler);
  app.get("/auth/me", { preHandler: requireAuth }, controller.meHandler);
}