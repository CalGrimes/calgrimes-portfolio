"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardFilters } from "./dashboard-filters";
import { RevenueChart } from "./revenue-chart";
import { BreakdownChart } from "./breakdown-chart";
import { MetricCard } from "./metric-card";
import { METRIC_CONFIGS, DEFAULT_VISIBLE_METRICS } from "./metric-configs";
import {
  resolveRange,
  granularityFor,
  buildTimeSeries,
  buildBreakdown,
  computeMetrics,
  type DateRangeKey,
  type MetricKey,
  type BreakdownDimension,
  type AggregatableInvoice,
} from "@/lib/invoices/aggregate";
import { Plus } from "lucide-react";

interface DashboardAnalyticsProps {
  invoices: AggregatableInvoice[];
}

export function DashboardAnalytics({ invoices }: DashboardAnalyticsProps) {
  const [selectedRange, setSelectedRange] = useState<DateRangeKey>("12m");
  const [selectedBreakdown, setSelectedBreakdown] = useState<BreakdownDimension>("month");
  const [visibleMetrics, setVisibleMetrics] = useState<MetricKey[]>(DEFAULT_VISIBLE_METRICS);
  const [showGrid, setShowGrid] = useState(true);
  const [showDataPoints, setShowDataPoints] = useState(false);

  const today = new Date();
  const range = resolveRange(selectedRange, today);
  const filteredInvoices = invoices.filter(
    (inv) => inv.issueDate >= range.from && inv.issueDate <= range.to
  );

  const granularity = granularityFor(range.from, range.to);
  const timeSeries = buildTimeSeries(filteredInvoices, {
    from: range.from,
    to: range.to,
    granularity,
  });

  const breakdown = buildBreakdown(filteredInvoices, selectedBreakdown);

  // Compute previous period for comparison
  const prevRange = resolveRange(selectedRange, new Date(range.from));
  const prevInvoices = invoices.filter(
    (inv) => inv.issueDate >= prevRange.from && inv.issueDate < range.from
  );
  const metrics = computeMetrics(filteredInvoices, prevInvoices);

  const handleToggleMetric = (metric: MetricKey) => {
    setVisibleMetrics((prev) =>
      prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl">Invoice Analytics</h1>
          <p className="text-muted-foreground mt-2">Track revenue, invoices, and payments</p>
        </div>
        <Button asChild>
          <Link href="/admin/new">
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border p-6">
        <h2 className="font-heading text-lg mb-6">Filters</h2>
        <DashboardFilters
          selectedRange={selectedRange}
          onRangeChange={setSelectedRange}
          selectedBreakdown={selectedBreakdown}
          onBreakdownChange={setSelectedBreakdown}
          visibleMetrics={visibleMetrics}
          onToggleMetric={handleToggleMetric}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {visibleMetrics.map((metric) => {
          const config = METRIC_CONFIGS[metric];
          const data = metrics[metric];
          const formatter = config.kind === "money"
            ? (val: number) => `£${val.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`
            : (val: number) => val.toLocaleString("en-GB");

          return (
            <MetricCard
              key={metric}
              title={config.name}
              metric={data}
              icon={config.icon}
              accentColor={config.color}
              formatValue={formatter}
            />
          );
        })}
      </div>

      <div className="rounded-lg border p-6">
        <h2 className="font-heading text-lg mb-6">Revenue Trend</h2>
        <RevenueChart
          data={timeSeries}
          visibleMetrics={visibleMetrics}
          onToggleMetric={handleToggleMetric}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid(!showGrid)}
          showDataPoints={showDataPoints}
          onToggleDataPoints={() => setShowDataPoints(!showDataPoints)}
        />
      </div>

      {breakdown.length > 0 && (
        <div className="rounded-lg border p-6">
          <h2 className="font-heading text-lg mb-6">Breakdown by {selectedBreakdown}</h2>
          <BreakdownChart data={breakdown} />
        </div>
      )}

      {filteredInvoices.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground">No invoices in selected period</p>
        </div>
      )}
    </div>
  );
}
