"use client";

import { METRIC_CONFIGS } from "@/components/invoices/metric-configs";
import { Button } from "@/components/ui/button";
import type {
  BreakdownDimension,
  DateRangeKey,
  MetricKey,
} from "@/lib/invoices/aggregate";

const RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "6m", label: "6 months" },
  { value: "12m", label: "12 months" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
];

const BREAKDOWN_OPTIONS: { value: BreakdownDimension; label: string }[] = [
  { value: "client", label: "By client" },
  { value: "status", label: "By status" },
  { value: "month", label: "By month" },
];

interface DashboardFiltersProps {
  selectedRange: DateRangeKey;
  onRangeChange: (range: DateRangeKey) => void;
  selectedBreakdown: BreakdownDimension;
  onBreakdownChange: (dimension: BreakdownDimension) => void;
  visibleMetrics: MetricKey[];
  onToggleMetric: (metric: MetricKey) => void;
}

export function DashboardFilters({
  selectedRange,
  onRangeChange,
  selectedBreakdown,
  onBreakdownChange,
  visibleMetrics,
  onToggleMetric,
}: DashboardFiltersProps) {
  const metricKeys = Object.keys(METRIC_CONFIGS) as MetricKey[];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Date range</p>
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={selectedRange === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => onRangeChange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Breakdown</p>
        <div className="flex flex-wrap gap-2">
          {BREAKDOWN_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={selectedBreakdown === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => onBreakdownChange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Metrics</p>
        <div className="flex flex-wrap gap-2">
          {metricKeys.map((key) => (
            <Button
              key={key}
              variant={visibleMetrics.includes(key) ? "default" : "outline"}
              size="sm"
              onClick={() => onToggleMetric(key)}
            >
              {METRIC_CONFIGS[key].name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
