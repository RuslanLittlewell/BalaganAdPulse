import { afterEach, describe, expect, it, vi } from "vitest";
import { LogMailTransport } from "../../src/shared/infrastructure/mail.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("the development mail transport", () => {
  it("logs the reply-to address and each attachment's name, type and size", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await new LogMailTransport().send({
      to: "balagan.ads@gmail.com",
      subject: "Hello",
      text: "Body",
      html: "<p>Body</p>",
      replyTo: "anna@acme.com",
      attachments: [{ filename: "screenshot-1.png", content: Buffer.alloc(12), contentType: "image/png" }],
    });

    const logged = String(info.mock.calls[0]?.[0]);
    expect(logged).toContain("Mail to balagan.ads@gmail.com, reply to anna@acme.com (Hello)");
    expect(logged).toContain("[attachment] screenshot-1.png, image/png, 12 bytes");
  });
});
