import { describe, it, expect } from "vitest";
import {
  matchesDomainPattern,
  isHostAllowed,
  getHostnameFromOrigin,
  validateOrigin,
} from "./domain-allowlist";

describe("matchesDomainPattern", () => {
  it("matches exact domain", () => {
    expect(matchesDomainPattern("example.com", "example.com")).toBe(true);
    expect(matchesDomainPattern("Example.COM", "example.com")).toBe(true);
  });

  it("rejects non-matching domain", () => {
    expect(matchesDomainPattern("other.com", "example.com")).toBe(false);
    expect(matchesDomainPattern("notexample.com", "example.com")).toBe(false);
  });

  it("matches wildcard *", () => {
    expect(matchesDomainPattern("anything.com", "*")).toBe(true);
    expect(matchesDomainPattern("sub.domain.example.org", "*")).toBe(true);
  });

  it("matches wildcard subdomain *.example.com", () => {
    expect(matchesDomainPattern("sub.example.com", "*.example.com")).toBe(true);
    expect(matchesDomainPattern("deep.sub.example.com", "*.example.com")).toBe(true);
    expect(matchesDomainPattern("example.com", "*.example.com")).toBe(true);
  });

  it("rejects non-matching wildcard subdomain", () => {
    expect(matchesDomainPattern("example.org", "*.example.com")).toBe(false);
    expect(matchesDomainPattern("notexample.com", "*.example.com")).toBe(false);
    expect(matchesDomainPattern("exampleXcom", "*.example.com")).toBe(false);
  });

  it("handles empty/null inputs", () => {
    expect(matchesDomainPattern("", "example.com")).toBe(false);
    expect(matchesDomainPattern("example.com", "")).toBe(false);
  });
});

describe("isHostAllowed", () => {
  it("allows all when no allowlist configured", () => {
    expect(isHostAllowed("anything.com", undefined)).toBe(true);
    expect(isHostAllowed("anything.com", [])).toBe(true);
  });

  it("allows matching domains", () => {
    const allowlist = ["example.com", "*.trusted.org"];
    expect(isHostAllowed("example.com", allowlist)).toBe(true);
    expect(isHostAllowed("sub.trusted.org", allowlist)).toBe(true);
  });

  it("rejects non-matching domains", () => {
    const allowlist = ["example.com", "*.trusted.org"];
    expect(isHostAllowed("evil.com", allowlist)).toBe(false);
    expect(isHostAllowed("untrusted.org", allowlist)).toBe(false);
  });
});

describe("getHostnameFromOrigin", () => {
  it("extracts hostname from valid origin", () => {
    expect(getHostnameFromOrigin("https://example.com")).toBe("example.com");
    expect(getHostnameFromOrigin("https://example.com:8080")).toBe("example.com");
    expect(getHostnameFromOrigin("http://sub.example.com/path")).toBe("sub.example.com");
  });

  it("returns null for invalid input", () => {
    expect(getHostnameFromOrigin(null)).toBe(null);
    expect(getHostnameFromOrigin("not-a-url")).toBe(null);
  });
});

describe("validateOrigin", () => {
  it("validates origin against allowlist", () => {
    const allowlist = ["example.com", "*.trusted.org"];
    expect(validateOrigin("https://example.com", allowlist)).toBe(true);
    expect(validateOrigin("https://sub.trusted.org", allowlist)).toBe(true);
    expect(validateOrigin("https://evil.com", allowlist)).toBe(false);
  });

  it("handles missing origin with wildcard", () => {
    expect(validateOrigin(null, ["*"])).toBe(true);
    expect(validateOrigin(null, undefined)).toBe(true);
  });

  it("rejects missing origin when allowlist is restrictive", () => {
    expect(validateOrigin(null, ["example.com"])).toBe(false);
  });
});
