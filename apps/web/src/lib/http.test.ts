import { http as mock, HttpResponse } from "msw";
import { server } from "../test/server.js";
import { http, ApiError } from "./http.js";
import { makeAccessToken, makeExpiredAccessToken } from "../test/token.js";
import { writeTokens } from "./auth/tokenStore.js";

describe("http", () => {
  it("gets and parses JSON", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([{ id: "1", name: "Acme" }])),
    );
    const data = await http.get<Array<{ id: string; name: string }>>("/clients");
    expect(data).toEqual([{ id: "1", name: "Acme" }]);
  });

  it("posts a body and returns the created resource", async () => {
    server.use(
      mock.post("/api/clients", async ({ request }) => {
        const body = (await request.json()) as { name: string };
        return HttpResponse.json({ id: "2", name: body.name }, { status: 201 });
      }),
    );
    const created = await http.post<{ id: string; name: string }>("/clients", { name: "New" });
    expect(created).toEqual({ id: "2", name: "New" });
  });

  it("returns void for a 204 delete", async () => {
    server.use(mock.delete("/api/clients/1", () => new HttpResponse(null, { status: 204 })));
    await expect(http.del("/clients/1")).resolves.toBeUndefined();
  });

  it("throws ApiError carrying status, message and details on a non-2xx response", async () => {
    server.use(
      mock.post("/api/clients", () =>
        HttpResponse.json(
          { error: { message: "Validation error", details: [{ path: ["name"], message: "name is required" }] } },
          { status: 400 },
        ),
      ),
    );
    const err = (await http.post("/clients", {}).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe("Validation error");
    expect(err.details).toEqual([{ path: ["name"], message: "name is required" }]);
  });
});

describe("authenticated requests", () => {
  beforeEach(() => localStorage.clear());

  it("sends the stored token", async () => {
    const accessToken = makeAccessToken();
    writeTokens({ accessToken, refreshToken: "r" });
    let seen: string | null = null;
    server.use(mock.get("/api/clients", ({ request }) => {
      seen = request.headers.get("authorization");
      return HttpResponse.json([]);
    }));

    await http.get("/clients");
    expect(seen).toBe(`Bearer ${accessToken}`);
  });

  it("sends no header when there is no session", async () => {
    let seen: string | null = "unset";
    server.use(mock.get("/api/clients", ({ request }) => {
      seen = request.headers.get("authorization");
      return HttpResponse.json([]);
    }));

    await http.get("/clients");
    expect(seen).toBeNull();
  });

  it("renews before the request when the token is stale", async () => {
    const renewed = makeAccessToken({ name: "Renewed" });
    writeTokens({ accessToken: makeExpiredAccessToken(), refreshToken: "r" });
    server.use(
      mock.post("/api/auth/refresh", () => HttpResponse.json({ accessToken: renewed })),
      mock.get("/api/clients", ({ request }) => {
        expect(request.headers.get("authorization")).toBe(`Bearer ${renewed}`);
        return HttpResponse.json([]);
      }),
    );

    await expect(http.get("/clients")).resolves.toEqual([]);
  });

  it("repeats exactly once after a 401", async () => {
    const renewed = makeAccessToken({ name: "Renewed" });
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    let attempts = 0;
    server.use(
      mock.post("/api/auth/refresh", () => HttpResponse.json({ accessToken: renewed })),
      mock.get("/api/clients", () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ error: { message: "Authentication required" } }, { status: 401 })
          : HttpResponse.json([{ id: "c1" }]);
      }),
    );

    await expect(http.get("/clients")).resolves.toEqual([{ id: "c1" }]);
    expect(attempts).toBe(2);
  });

  it("gives up after a second 401 instead of looping", async () => {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    let attempts = 0;
    server.use(
      mock.post("/api/auth/refresh", () =>
        HttpResponse.json({ accessToken: makeAccessToken() })),
      mock.get("/api/clients", () => {
        attempts += 1;
        return HttpResponse.json({ error: { message: "nope" } }, { status: 401 });
      }),
    );

    await expect(http.get("/clients")).rejects.toMatchObject({ status: 401 });
    expect(attempts).toBe(2);
  });
});

describe("unauthenticated requests", () => {
  beforeEach(() => localStorage.clear());

  it("sends no Authorization header and never renews, even with a valid session", async () => {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    let refreshCalls = 0;
    let seen: string | null = "unset";
    server.use(
      mock.post("/api/auth/refresh", () => {
        refreshCalls += 1;
        return HttpResponse.json({ accessToken: makeAccessToken() });
      }),
      mock.post("/api/auth/login", ({ request }) => {
        seen = request.headers.get("authorization");
        return HttpResponse.json({ accessToken: "a", refreshToken: "r" });
      }),
    );

    await http.post("/auth/login", { email: "buyer@acme.com", password: "x" }, { authenticated: false });

    expect(seen).toBeNull();
    expect(refreshCalls).toBe(0);
  });

  it("does not repeat after a 401, so a wrong password is checked exactly once", async () => {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    let attempts = 0;
    server.use(
      mock.post("/api/auth/login", () => {
        attempts += 1;
        return HttpResponse.json(
          { error: { message: "Invalid email or password" } }, { status: 401 },
        );
      }),
    );

    await expect(
      http.post("/auth/login", { email: "buyer@acme.com", password: "wrong" }, { authenticated: false }),
    ).rejects.toMatchObject({ status: 401 });
    expect(attempts).toBe(1);
  });
});
