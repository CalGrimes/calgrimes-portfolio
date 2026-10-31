import { describe, expect, it } from "vitest";

import { nextInvoiceNumber } from "./numbering";

describe("nextInvoiceNumber", () => {
  it("starts at 0001 when there are no invoices", () => {
    expect(nextInvoiceNumber([], 2026)).toBe("INV-2026-0001");
  });

  it("increments past the highest existing number for the year", () => {
    expect(
      nextInvoiceNumber(["INV-2026-0001", "INV-2026-0007", "INV-2026-0003"], 2026)
    ).toBe("INV-2026-0008");
  });

  it("ignores invoices from other years", () => {
    expect(
      nextInvoiceNumber(["INV-2025-0042", "INV-2026-0002"], 2026)
    ).toBe("INV-2026-0003");
  });

  it("restarts numbering in a new year", () => {
    expect(nextInvoiceNumber(["INV-2025-0042"], 2026)).toBe("INV-2026-0001");
  });

  it("ignores malformed numbers rather than throwing", () => {
    expect(
      nextInvoiceNumber(["INV-2026-abc", "", "INV-2026-0004"], 2026)
    ).toBe("INV-2026-0005");
  });

  it("keeps zero padding past four digits", () => {
    expect(nextInvoiceNumber(["INV-2026-9999"], 2026)).toBe("INV-2026-10000");
  });
});
