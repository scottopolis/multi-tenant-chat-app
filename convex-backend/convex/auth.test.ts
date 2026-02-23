import { describe, expect, it } from "vitest";
import { assertIdentity, assertTenantAccess, assertUserMatches } from "./auth";

describe("auth helpers", () => {
  it("throws when identity is missing", () => {
    expect(() => assertIdentity(null)).toThrow("Unauthorized");
  });

  it("allows matching clerk user id", () => {
    expect(() =>
      assertUserMatches({ subject: "user_123" }, "user_123")
    ).not.toThrow();
  });

  it("rejects mismatched clerk user id", () => {
    expect(() =>
      assertUserMatches({ subject: "user_123" }, "user_456")
    ).toThrow("Forbidden");
  });

  it("allows matching tenant ids", () => {
    expect(() =>
      assertTenantAccess("tenant_1" as any, "tenant_1" as any)
    ).not.toThrow();
  });

  it("rejects mismatched tenant ids", () => {
    expect(() =>
      assertTenantAccess("tenant_1" as any, "tenant_2" as any)
    ).toThrow("Forbidden");
  });
});
