import { describe, expect, it } from "vitest";

import { isAllowedAdmin } from "./auth-allowlist";

const ADMIN = "calgrimes29@gmail.com";

describe("isAllowedAdmin", () => {
  it("accepts the exact allowlisted address when verified", () => {
    expect(isAllowedAdmin(ADMIN, ADMIN, true)).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isAllowedAdmin("CalGrimes29@Gmail.com", ADMIN, true)).toBe(true);
  });

  it("tolerates surrounding whitespace on both sides", () => {
    expect(isAllowedAdmin(`  ${ADMIN} `, ` ${ADMIN}`, true)).toBe(true);
  });

  it("accepts a verified string flag from Google", () => {
    expect(isAllowedAdmin(ADMIN, ADMIN, "true")).toBe(true);
  });

  it("rejects an unverified email", () => {
    expect(isAllowedAdmin(ADMIN, ADMIN, false)).toBe(false);
    expect(isAllowedAdmin(ADMIN, ADMIN, undefined)).toBe(false);
  });

  it("rejects any other address", () => {
    expect(isAllowedAdmin("someone@gmail.com", ADMIN, true)).toBe(false);
  });

  it("does not treat gmail dot-aliases as equal", () => {
    expect(isAllowedAdmin("cal.grimes29@gmail.com", ADMIN, true)).toBe(false);
  });

  it("fails closed when the allowlist is unset or empty", () => {
    expect(isAllowedAdmin(ADMIN, undefined, true)).toBe(false);
    expect(isAllowedAdmin(ADMIN, "", true)).toBe(false);
    expect(isAllowedAdmin(ADMIN, "   ", true)).toBe(false);
  });

  it("rejects a missing profile email", () => {
    expect(isAllowedAdmin(null, ADMIN, true)).toBe(false);
    expect(isAllowedAdmin(undefined, ADMIN, true)).toBe(false);
    expect(isAllowedAdmin("", ADMIN, true)).toBe(false);
  });
});
