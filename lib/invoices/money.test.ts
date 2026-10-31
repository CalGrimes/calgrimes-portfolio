import { describe, expect, it } from "vitest";

import {
  computeLineAmountMinor,
  formatMoney,
  fromMilli,
  toMajor,
  toMilli,
  toMinor,
} from "./money";

describe("toMinor", () => {
  it("converts whole and fractional amounts", () => {
    expect(toMinor("1234.56")).toBe(123456);
    expect(toMinor("80")).toBe(8000);
    expect(toMinor("0.05")).toBe(5);
    expect(toMinor("0")).toBe(0);
  });

  it("pads a single decimal place", () => {
    expect(toMinor("12.5")).toBe(1250);
  });

  it("strips currency symbols, commas and whitespace", () => {
    expect(toMinor(" £1,234.56 ")).toBe(123456);
  });

  it("handles negatives", () => {
    expect(toMinor("-40.25")).toBe(-4025);
  });

  it("accepts numbers without float drift", () => {
    expect(toMinor(1234.56)).toBe(123456);
    expect(toMinor(0.29)).toBe(29);
    expect(toMinor(1.005)).toBe(101);
  });

  it("throws on malformed input", () => {
    expect(() => toMinor("abc")).toThrow(/valid money amount/);
    expect(() => toMinor("1.234")).toThrow(/valid money amount/);
    expect(() => toMinor("")).toThrow(/valid money amount/);
  });
});

describe("toMajor", () => {
  it("is the inverse of toMinor", () => {
    expect(toMajor(123456)).toBe(1234.56);
    expect(toMajor(5)).toBe(0.05);
    expect(toMajor(-4025)).toBe(-40.25);
  });
});

describe("toMilli / fromMilli", () => {
  it("converts quantities to thousandths", () => {
    expect(toMilli("7.5")).toBe(7500);
    expect(toMilli("1")).toBe(1000);
    expect(toMilli("0.125")).toBe(125);
    expect(toMilli(2.25)).toBe(2250);
  });

  it("round-trips", () => {
    expect(fromMilli(7500)).toBe(7.5);
    expect(fromMilli(1000)).toBe(1);
  });

  it("throws on more than three decimal places", () => {
    expect(() => toMilli("0.1234")).toThrow(/valid quantity/);
  });
});

describe("computeLineAmountMinor", () => {
  it("multiplies quantity by unit price", () => {
    expect(computeLineAmountMinor(7500, 8000)).toBe(60000);
    expect(computeLineAmountMinor(1000, 123456)).toBe(123456);
  });

  it("rounds half up to the nearest penny", () => {
    expect(computeLineAmountMinor(333, 100)).toBe(33);
    expect(computeLineAmountMinor(335, 100)).toBe(34);
  });

  it("returns an integer for every input", () => {
    expect(Number.isInteger(computeLineAmountMinor(1234, 5678))).toBe(true);
  });
});

describe("formatMoney", () => {
  it("formats GBP in en-GB by default", () => {
    expect(formatMoney(123456)).toBe("£1,234.56");
    expect(formatMoney(0)).toBe("£0.00");
  });

  it("honours an explicit currency", () => {
    expect(formatMoney(123456, "USD", "en-US")).toBe("$1,234.56");
  });
});
