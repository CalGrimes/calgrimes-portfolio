import type {
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
} from "@/lib/db/schema";

import { toMajor } from "./money";

export type AggregatableInvoice = Pick<
  Invoice,
  "id" | "number" | "issueDate" | "status" | "totalMinor" | "currency" | "clientName"
>;

export type MetricKey = "billed" | "paid" | "outstanding" | "count" | "avgInvoice";
export type Granularity = "day" | "week" | "month";
export type DateRangeKey = "30d" | "90d" | "6m" | "12m" | "ytd" | "all";
export type BreakdownDimension = "client" | "status" | "month";

export const YTD_THRESHOLD_MINOR = 1_250_000;

export interface SeriesPoint {
  date: string;
  dateFormatted: string;
  billed: number;
  paid: number;
  outstanding: number;
  count: number;
  avgInvoice: number;
}

export interface BreakdownRow {
  key: string;
  label: string;
  billedMinor: number;
  count: number;
  share: number;
}

export interface MetricData {
  current: number;
  previous: number;
  change: number;
  trend: "up" | "down" | "neutral";
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function resolveRange(
  key: DateRangeKey,
  today: Date
): { from: string; to: string } {
  const to = dateStr(today);
  let from: string;

  switch (key) {
    case "30d":
      from = dateStr(addDays(today, -29));
      break;
    case "90d":
      from = dateStr(addDays(today, -89));
      break;
    case "6m":
      from = dateStr(addDays(today, -180));
      break;
    case "12m":
      from = dateStr(addDays(today, -365));
      break;
    case "ytd":
      from = `${today.getFullYear()}-01-01`;
      break;
    case "all":
      from = "1970-01-01";
      break;
  }

  return { from, to };
}

export function granularityFor(from: string, to: string): Granularity {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const daysApart = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysApart <= 62) return "day";
  if (daysApart <= 365) return "week";
  return "month";
}

function bucketStart(date: string, granularity: Granularity): string {
  const d = new Date(date);
  switch (granularity) {
    case "day":
      return dateStr(d);
    case "week":
      const day = d.getDay();
      const diff = d.getDate() - day;
      return dateStr(new Date(d.setDate(diff)));
    case "month":
      return dateStr(startOfMonth(d));
  }
}

function nextBucket(date: string, granularity: Granularity): string {
  const d = new Date(date);
  switch (granularity) {
    case "day":
      d.setDate(d.getDate() + 1);
      break;
    case "week":
      d.setDate(d.getDate() + 7);
      break;
    case "month":
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return dateStr(d);
}

function formatBucket(date: string, granularity: Granularity): string {
  const d = new Date(date);
  switch (granularity) {
    case "day":
      return d.toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
      });
    case "week":
      const weekEnd = new Date(d);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${d.toLocaleDateString("en-GB", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-GB", { month: "short", day: "numeric" })}`;
    case "month":
      return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  }
}

export interface TimeSeriesOpts {
  from: string;
  to: string;
  granularity: Granularity;
}

export function buildTimeSeries(
  rows: AggregatableInvoice[],
  opts: TimeSeriesOpts
): SeriesPoint[] {
  const series: SeriesPoint[] = [];
  let current = opts.from;

  while (current <= opts.to) {
    const next = nextBucket(current, opts.granularity);
    const bucketed = rows.filter(
      (r) => r.issueDate >= current && r.issueDate < next
    );

    const billed = bucketed.reduce((sum, r) => sum + r.totalMinor, 0);
    const paid = bucketed
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + r.totalMinor, 0);
    const outstanding = bucketed
      .filter((r) => r.status === "sent" || r.status === "overdue")
      .reduce((sum, r) => sum + r.totalMinor, 0);
    const count = bucketed.length;
    const avgInvoice = count > 0 ? billed / count : 0;

    series.push({
      date: current,
      dateFormatted: formatBucket(current, opts.granularity),
      billed: toMajor(billed),
      paid: toMajor(paid),
      outstanding: toMajor(outstanding),
      count,
      avgInvoice: toMajor(avgInvoice),
    });

    current = next;
  }

  return series;
}

export function buildBreakdown(
  rows: AggregatableInvoice[],
  dimension: BreakdownDimension
): BreakdownRow[] {
  const groups: Record<string, { label: string; billedMinor: number; count: number }> =
    {};
  const totalBilled = rows.reduce((sum, r) => sum + r.totalMinor, 0);

  for (const row of rows) {
    let key: string;
    let label: string;

    if (dimension === "client") {
      key = row.clientName;
      label = row.clientName;
    } else if (dimension === "status") {
      key = row.status;
      label =
        row.status.charAt(0).toUpperCase() + row.status.slice(1);
    } else {
      // month
      key = row.issueDate.slice(0, 7);
      label = new Date(`${key}-01`).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      });
    }

    if (!groups[key]) {
      groups[key] = { label, billedMinor: 0, count: 0 };
    }
    groups[key].billedMinor += row.totalMinor;
    groups[key].count += 1;
  }

  const breakdown: BreakdownRow[] = Object.entries(groups)
    .map(([key, value]) => ({
      key,
      label: value.label,
      billedMinor: value.billedMinor,
      count: value.count,
      share: totalBilled > 0 ? value.billedMinor / totalBilled : 0,
    }))
    .sort((a, b) => b.billedMinor - a.billedMinor);

  return breakdown;
}

export function computeMetrics(
  current: AggregatableInvoice[],
  previous: AggregatableInvoice[]
): Record<MetricKey, MetricData> {
  function compute(rows: AggregatableInvoice[]) {
    const billed = rows.reduce((sum, r) => sum + r.totalMinor, 0);
    const paid = rows
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + r.totalMinor, 0);
    const outstanding = rows
      .filter((r) => r.status === "sent" || r.status === "overdue")
      .reduce((sum, r) => sum + r.totalMinor, 0);
    const count = rows.length;
    const avgInvoice = count > 0 ? billed / count : 0;

    return {
      billed: toMajor(billed),
      paid: toMajor(paid),
      outstanding: toMajor(outstanding),
      count,
      avgInvoice: toMajor(avgInvoice),
    };
  }

  const currValues = compute(current);
  const prevValues = compute(previous);

  const result: Record<MetricKey, MetricData> = {} as any;

  for (const key of ["billed", "paid", "outstanding", "count", "avgInvoice"] as const) {
    const curr = currValues[key];
    const prev = prevValues[key];
    const change =
      prev === 0
        ? 0
        : ((curr - prev) / prev) * 100;
    const trend: "up" | "down" | "neutral" =
      prev === 0
        ? "neutral"
        : change > 0
          ? "up"
          : change < 0
            ? "down"
            : "neutral";

    result[key] = {
      current: curr,
      previous: prev,
      change,
      trend,
    };
  }

  return result;
}

export function ytdBilledMinor(rows: AggregatableInvoice[], year: number): number {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  return rows
    .filter((r) => r.issueDate >= yearStart && r.issueDate <= yearEnd && r.status !== "void")
    .reduce((sum, r) => sum + r.totalMinor, 0);
}
