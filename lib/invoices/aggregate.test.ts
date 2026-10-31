import { describe, expect, it } from "vitest";

import {
  YTD_THRESHOLD_MINOR,
  buildBreakdown,
  buildTimeSeries,
  computeMetrics,
  granularityFor,
  resolveRange,
  ytdBilledMinor,
} from "./aggregate";
import type { AggregatableInvoice } from "./aggregate";

function invoice(
  partial: Partial<AggregatableInvoice> & Pick<AggregatableInvoice, "issueDate">
): AggregatableInvoice {
  return {
    id: partial.id ?? crypto.randomUUID(),
    number: partial.number ?? "INV-2026-0001",
    clientName: partial.clientName ?? "Acme Ltd",
    status: partial.status ?? "sent",
    issueDate: partial.issueDate,
    totalMinor: partial.totalMinor ?? 10000,
    currency: partial.currency ?? "GBP",
  };
}

describe("resolveRange", () => {
  const today = new Date("2026-09-01T12:00:00Z");

  it("resolves a rolling 30 day window", () => {
    expect(resolveRange("30d", today)).toEqual({
      from: "2026-08-03",
      to: "2026-09-01",
    });
  });

  it("resolves year to date from January 1st", () => {
    expect(resolveRange("ytd", today)).toEqual({
      from: "2026-01-01",
      to: "2026-09-01",
    });
  });

  it("resolves 'all' to a wide open window", () => {
    expect(resolveRange("all", today).from).toBe("1970-01-01");
    expect(resolveRange("all", today).to).toBe("2026-09-01");
  });
});

describe("granularityFor", () => {
  it("uses days for short ranges", () => {
    expect(granularityFor("2026-08-03", "2026-09-01")).toBe("day");
  });

  it("uses weeks for ranges up to a year", () => {
    expect(granularityFor("2026-01-01", "2026-09-01")).toBe("week");
  });

  it("uses months beyond a year", () => {
    expect(granularityFor("2023-01-01", "2026-09-01")).toBe("month");
  });
});

describe("buildTimeSeries", () => {
  const rows = [
    invoice({ issueDate: "2026-08-01", totalMinor: 100000, status: "paid" }),
    invoice({ issueDate: "2026-08-01", totalMinor: 50000, status: "sent" }),
    invoice({ issueDate: "2026-08-03", totalMinor: 20000, status: "overdue" }),
  ];

  it("buckets by day and returns money in major units", () => {
    const series = buildTimeSeries(rows, {
      from: "2026-08-01",
      to: "2026-08-03",
      granularity: "day",
    });

    expect(series).toHaveLength(3);
    expect(series[0]).toMatchObject({
      date: "2026-08-01",
      billed: 1500,
      paid: 1000,
      outstanding: 500,
      count: 2,
      avgInvoice: 750,
    });
  });

  it("emits empty buckets for days with no invoices", () => {
    const series = buildTimeSeries(rows, {
      from: "2026-08-01",
      to: "2026-08-03",
      granularity: "day",
    });
    expect(series[1]).toMatchObject({
      date: "2026-08-02",
      billed: 0,
      count: 0,
      avgInvoice: 0,
    });
  });

  it("counts overdue as outstanding", () => {
    const series = buildTimeSeries(rows, {
      from: "2026-08-03",
      to: "2026-08-03",
      granularity: "day",
    });
    expect(series[0].outstanding).toBe(200);
  });

  it("excludes invoices outside the window", () => {
    const series = buildTimeSeries(rows, {
      from: "2026-08-02",
      to: "2026-08-03",
      granularity: "day",
    });
    expect(series.reduce((sum, p) => sum + p.count, 0)).toBe(1);
  });

  it("buckets by month", () => {
    const series = buildTimeSeries(
      [
        invoice({ issueDate: "2026-07-15", totalMinor: 100000 }),
        invoice({ issueDate: "2026-08-01", totalMinor: 50000 }),
        invoice({ issueDate: "2026-08-28", totalMinor: 50000 }),
      ],
      { from: "2026-07-01", to: "2026-08-31", granularity: "month" }
    );
    expect(series.map((p) => p.date)).toEqual(["2026-07-01", "2026-08-01"]);
    expect(series[1].billed).toBe(1000);
  });

  it("never divides by zero when computing the average", () => {
    const series = buildTimeSeries([], {
      from: "2026-08-01",
      to: "2026-08-01",
      granularity: "day",
    });
    expect(series[0].avgInvoice).toBe(0);
  });
});

describe("buildBreakdown", () => {
  const rows = [
    invoice({ clientName: "Acme Ltd", totalMinor: 120000, issueDate: "2026-08-01" }),
    invoice({ clientName: "Acme Ltd", totalMinor: 40000, issueDate: "2026-08-02" }),
    invoice({ clientName: "Globex", totalMinor: 40000, issueDate: "2026-08-03" }),
  ];

  it("groups by client, sorted by amount descending", () => {
    const breakdown = buildBreakdown(rows, "client");
    expect(breakdown.map((b) => b.label)).toEqual(["Acme Ltd", "Globex"]);
    expect(breakdown[0].billedMinor).toBe(160000);
    expect(breakdown[0].count).toBe(2);
  });

  it("computes each row's share of the total", () => {
    const breakdown = buildBreakdown(rows, "client");
    expect(breakdown[0].share).toBeCloseTo(0.8);
    expect(breakdown[1].share).toBeCloseTo(0.2);
  });

  it("groups by status", () => {
    const breakdown = buildBreakdown(
      [
        invoice({ status: "paid", totalMinor: 10000, issueDate: "2026-08-01" }),
        invoice({ status: "sent", totalMinor: 30000, issueDate: "2026-08-01" }),
      ],
      "status"
    );
    expect(breakdown.map((b) => b.key)).toEqual(["sent", "paid"]);
  });

  it("groups by month", () => {
    const breakdown = buildBreakdown(
      [
        invoice({ issueDate: "2026-07-01", totalMinor: 10000 }),
        invoice({ issueDate: "2026-08-01", totalMinor: 30000 }),
      ],
      "month"
    );
    expect(breakdown[0].key).toBe("2026-08");
  });

  it("returns an empty array with no rows", () => {
    expect(buildBreakdown([], "client")).toEqual([]);
  });
});

describe("computeMetrics", () => {
  const current = [
    invoice({ issueDate: "2026-08-01", totalMinor: 100000, status: "paid" }),
    invoice({ issueDate: "2026-08-02", totalMinor: 100000, status: "sent" }),
  ];
  const previous = [
    invoice({ issueDate: "2026-07-01", totalMinor: 100000, status: "paid" }),
  ];

  it("computes current values in major units", () => {
    const metrics = computeMetrics(current, previous);
    expect(metrics.billed.current).toBe(2000);
    expect(metrics.paid.current).toBe(1000);
    expect(metrics.outstanding.current).toBe(1000);
    expect(metrics.count.current).toBe(2);
    expect(metrics.avgInvoice.current).toBe(1000);
  });

  it("computes percentage change against the previous period", () => {
    const metrics = computeMetrics(current, previous);
    expect(metrics.billed.previous).toBe(1000);
    expect(metrics.billed.change).toBeCloseTo(100);
    expect(metrics.billed.trend).toBe("up");
  });

  it("reports a neutral trend when the previous period is empty", () => {
    const metrics = computeMetrics(current, []);
    expect(metrics.billed.change).toBe(0);
    expect(metrics.billed.trend).toBe("neutral");
  });

  it("reports a downward trend when billing falls", () => {
    const metrics = computeMetrics(previous, current);
    expect(metrics.billed.trend).toBe("down");
  });
});

describe("ytdBilledMinor", () => {
  it("sums only the given calendar year", () => {
    const rows = [
      invoice({ issueDate: "2025-12-31", totalMinor: 500000 }),
      invoice({ issueDate: "2026-01-01", totalMinor: 300000 }),
      invoice({ issueDate: "2026-08-01", totalMinor: 200000 }),
    ];
    expect(ytdBilledMinor(rows, 2026)).toBe(500000);
  });

  it("excludes voided invoices", () => {
    const rows = [
      invoice({ issueDate: "2026-01-01", totalMinor: 300000 }),
      invoice({ issueDate: "2026-02-01", totalMinor: 100000, status: "void" }),
    ];
    expect(ytdBilledMinor(rows, 2026)).toBe(300000);
  });

  it("exposes the reporting threshold as 12,500 in minor units", () => {
    expect(YTD_THRESHOLD_MINOR).toBe(1250000);
  });
});
