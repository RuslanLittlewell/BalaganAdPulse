import { http as mock, HttpResponse } from "msw";
import { server } from "../test/server.js";
import { http, ApiError } from "./http.js";

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
