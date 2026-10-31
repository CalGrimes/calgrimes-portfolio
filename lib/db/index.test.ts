import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL = process.env.DATABASE_URL;

describe("getDb", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.DATABASE_URL = ORIGINAL;
  });

  it("throws a clear error when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    const { getDb } = await import("./index");
    expect(() => getDb()).toThrow("DATABASE_URL is not set");
  });

  it("memoises the client across calls", async () => {
    process.env.DATABASE_URL =
      "postgresql://user:pass@ep-test.eu-west-2.aws.neon.tech/neondb";
    const { getDb } = await import("./index");
    expect(getDb()).toBe(getDb());
  });
});
