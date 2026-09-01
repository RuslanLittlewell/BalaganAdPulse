import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import { createIdentityHttpRouters } from "../../src/modules/identity/presentation/http/identity-http.js";
import { errorHandler } from "../../src/shared/presentation/error-handler.js";

function appWith(useCases: Record<string, ReturnType<typeof vi.fn>>) {
  const app = express();
  app.use(express.json());
  const routers = createIdentityHttpRouters(useCases as never);
  app.use("/api/auth", routers.authRouter);
  // Stands in for the authentication middleware, which is what puts the
  // principal on the request in the composed application.
  app.use((req, _res, next) => { req.principal = { id: "u1", name: "Buyer", email: "buyer@acme.com" }; next(); });
  app.use("/api/user", routers.userRouter);
  app.use(errorHandler);
  return app;
}

describe("identity HTTP adapter", () => {
  it("validates and translates registration", async () => {
    const register = vi.fn().mockResolvedValue({ accessToken: "access", refreshToken: "refresh" });
    const app = appWith({ register });
    const response = await request(app).post("/api/auth/register").send({ name: " Buyer ", email: "BUYER@ACME.COM ", password: "password123", inviteCode: "invite" });
    expect(response.status).toBe(201);
    expect(register).toHaveBeenCalledWith({ name: "Buyer", email: "buyer@acme.com", password: "password123", inviteCode: "invite" });
    expect(response.body).toEqual({ accessToken: "access", refreshToken: "refresh" });
  });

  it("keeps logout and profile HTTP contracts", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const profile = vi.fn().mockResolvedValue({ name: "Buyer", email: "buyer@acme.com", image: null, avatarPath: null });
    const app = appWith({ logout, profile });
    expect((await request(app).post("/api/auth/logout").send({ refreshToken: "refresh" })).status).toBe(204);
    const response = await request(app).get("/api/user/profile");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: "Buyer", email: "buyer@acme.com", image: null, avatarPath: null });
  });
});
