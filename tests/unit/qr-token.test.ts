import { beforeAll, describe, expect, it } from "vitest";
import { signQrToken, verifyQrToken } from "@/lib/qr/token";

beforeAll(() => {
  process.env.QR_TOKEN_SECRET = "test-only-secret-do-not-use-in-prod";
});

describe("signQrToken / verifyQrToken", () => {
  it("round-trips a valid token", () => {
    const signed = signQrToken("clxyz123abc");
    const result = verifyQrToken(signed);
    expect(result).toEqual({ qrTokenId: "clxyz123abc" });
  });

  it("rejects a tampered id with the original signature", () => {
    const signed = signQrToken("clxyz123abc");
    const [, sig] = signed.split(".");
    const tampered = `different-id.${sig}`;
    expect(verifyQrToken(tampered)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const signed = signQrToken("clxyz123abc");
    const [id] = signed.split(".");
    expect(verifyQrToken(`${id}.forged-signature`)).toBeNull();
  });

  it("rejects malformed input with no separator", () => {
    expect(verifyQrToken("not-a-valid-token")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(verifyQrToken("")).toBeNull();
  });

  it("produces different signatures for different ids", () => {
    const a = signQrToken("id-a");
    const b = signQrToken("id-b");
    expect(a).not.toBe(b);
  });
});
