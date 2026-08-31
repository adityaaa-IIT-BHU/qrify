import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hashIp, sha256Hex } from "@/lib/crypto";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.IP_HASH_SALT = "test-salt";
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a plaintext value", () => {
    const ciphertext = encryptSecret("gho_super_secret_token");
    expect(ciphertext).not.toContain("gho_super_secret_token");
    expect(decryptSecret(ciphertext)).toBe("gho_super_secret_token");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same value");
    const b = encryptSecret("same value");
    expect(a).not.toBe(b);
  });

  it("fails to decrypt a tampered ciphertext (auth tag check)", () => {
    const ciphertext = encryptSecret("gho_super_secret_token");
    const [iv, tag, body] = ciphertext.split(":");
    const tampered = [iv, tag, Buffer.from("garbage").toString("base64")].join(":");
    expect(() => decryptSecret(tampered)).toThrow();
    void body;
  });
});

describe("hashIp", () => {
  it("is deterministic for the same ip + bucket", () => {
    expect(hashIp("1.2.3.4", "2026-01-01")).toBe(hashIp("1.2.3.4", "2026-01-01"));
  });

  it("differs across days (bucket) even for the same ip", () => {
    expect(hashIp("1.2.3.4", "2026-01-01")).not.toBe(hashIp("1.2.3.4", "2026-01-02"));
  });

  it("never contains the raw ip", () => {
    expect(hashIp("1.2.3.4", "2026-01-01")).not.toContain("1.2.3.4");
  });
});

describe("sha256Hex", () => {
  it("is deterministic", () => {
    expect(sha256Hex("hello")).toBe(sha256Hex("hello"));
  });
});
