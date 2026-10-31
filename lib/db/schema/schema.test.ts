import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { accounts, invoiceLineItems, invoices, sessions, users } from "./index";

describe("auth schema", () => {
  it("uses the exact column names Auth.js expects", () => {
    expect(Object.keys(getTableColumns(users)).sort()).toEqual(
      ["email", "emailVerified", "id", "image", "name"].sort()
    );
    expect(Object.keys(getTableColumns(accounts))).toContain(
      "providerAccountId"
    );
    expect(Object.keys(getTableColumns(sessions))).toContain("sessionToken");
  });
});

describe("invoices schema", () => {
  it("stores money in integer minor units and carries no tax columns", () => {
    const cols = Object.keys(getTableColumns(invoices));
    expect(cols).toContain("totalMinor");
    expect(cols).not.toContain("taxRate");
    expect(cols).not.toContain("taxAmount");
  });

  it("stores line quantities in thousandths", () => {
    const cols = Object.keys(getTableColumns(invoiceLineItems));
    expect(cols).toContain("quantityMilli");
    expect(cols).toContain("unitPriceMinor");
    expect(cols).toContain("amountMinor");
  });
});
