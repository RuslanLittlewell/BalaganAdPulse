import { describe, expect, it } from "vitest";
import { TotpAdapter, base32Decode, base32Encode, hotp, stepAt } from "../../src/modules/two-factor/infrastructure/totp-adapter.js";
import { AesTwoFactorSecrets } from "../../src/modules/two-factor/infrastructure/two-factor-secrets.js";
import { SvgQrRenderer } from "../../src/modules/two-factor/infrastructure/qr-renderer.js";

const RFC_SECRET = Buffer.from("12345678901234567890", "ascii");

describe("TOTP", () => {
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ])("matches the RFC 6238 SHA-1 vector at %i seconds", (seconds, expected) => {
    expect(hotp(RFC_SECRET, stepAt(new Date(seconds * 1000)), 8)).toBe(expected);
  });

  it("encodes and decodes base32 both ways", () => {
    expect(base32Encode(RFC_SECRET)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ").equals(RFC_SECRET)).toBe(true);
  });

  it("accepts the step before and after, and refuses a step already used", () => {
    const totp = new TotpAdapter();
    const secret = totp.newSecret();
    const now = new Date("2026-11-23T10:00:15Z");
    const step = stepAt(now);
    const code = (offset: number) => hotp(base32Decode(secret), step + offset);

    expect(totp.verify(secret, code(0), now, null)).toBe(step);
    expect(totp.verify(secret, code(-1), now, null)).toBe(step - 1);
    expect(totp.verify(secret, code(1), now, null)).toBe(step + 1);
    expect(totp.verify(secret, code(2), now, null)).toBeNull();
    expect(totp.verify(secret, code(0), now, step)).toBeNull();
  });

  it("writes the issuer with %20, which Google Authenticator shows as a space", () => {
    const raw = new TotpAdapter().uri("ABC234", "olga@acme.com", "Balagan BI");

    expect(raw).toBe("otpauth://totp/Balagan%20BI%3Aolga%40acme.com?secret=ABC234&issuer=Balagan%20BI&algorithm=SHA1&digits=6&period=30");
    expect(raw).not.toContain("+");
  });

  it("writes an otpauth address an app can read", () => {
    const uri = new URL(new TotpAdapter().uri("ABC234", "olga@acme.com", "Balagan BI"));

    expect(uri.protocol).toBe("otpauth:");
    expect(uri.host).toBe("totp");
    expect(decodeURIComponent(uri.pathname)).toBe("/Balagan BI:olga@acme.com");
    expect(Object.fromEntries(uri.searchParams)).toEqual({ secret: "ABC234", issuer: "Balagan BI", algorithm: "SHA1", digits: "6", period: "30" });
  });
});

describe("backup codes and secrets", () => {
  const secrets = new AesTwoFactorSecrets(Buffer.alloc(32, 7).toString("base64"));

  it("issues ten distinct codes of ten characters", () => {
    const codes = secrets.newBackupCodes(10);

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
  });

  it("hashes a code the same way however it is typed", () => {
    expect(secrets.hash("abcde-fghjk")).toBe(secrets.hash(" ABCDE FGHJK "));
  });

  it("seals a secret to its account", () => {
    const sealed = secrets.seal("SECRET", "u1");

    expect(sealed).not.toContain("SECRET");
    expect(secrets.unseal(sealed, "u1")).toBe("SECRET");
    expect(() => secrets.unseal(sealed, "u2")).toThrow();
  });

  it("draws the QR code as SVG", async () => {
    expect(await new SvgQrRenderer().svg("otpauth://totp/x?secret=ABC")).toMatch(/^<svg/);
  });
});
