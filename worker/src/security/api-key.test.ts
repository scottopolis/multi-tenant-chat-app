import { describe, it, expect } from "vitest";
import { hashApiKey, extractApiKey, generateApiKey } from "./api-key";

describe("hashApiKey", () => {
  it("produces consistent hash for same input", async () => {
    const hash1 = await hashApiKey("test-key");
    const hash2 = await hashApiKey("test-key");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", async () => {
    const hash1 = await hashApiKey("key-one");
    const hash2 = await hashApiKey("key-two");
    expect(hash1).not.toBe(hash2);
  });

  it("produces 64-character hex string", async () => {
    const hash = await hashApiKey("any-key");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("extractApiKey", () => {
  it("extracts key from valid Bearer token", () => {
    expect(extractApiKey("Bearer pk_live_abc123")).toBe("pk_live_abc123");
    expect(extractApiKey("Bearer   pk_live_abc123  ")).toBe("pk_live_abc123");
  });

  it("returns null for invalid formats", () => {
    expect(extractApiKey(null)).toBe(null);
    expect(extractApiKey("")).toBe(null);
    expect(extractApiKey("Basic abc123")).toBe(null);
    expect(extractApiKey("Bearer ")).toBe(null);
    expect(extractApiKey("Bearer")).toBe(null);
  });
});

describe("generateApiKey", () => {
  it("generates key with pk_live_ prefix", () => {
    const { key, prefix } = generateApiKey();
    expect(key).toMatch(/^pk_live_[a-f0-9]{64}$/);
    expect(prefix).toBe(key.slice(0, 12));
  });

  it("generates unique keys", () => {
    const keys = new Set<string>();
    for (let i = 0; i < 10; i++) {
      keys.add(generateApiKey().key);
    }
    expect(keys.size).toBe(10);
  });
});
