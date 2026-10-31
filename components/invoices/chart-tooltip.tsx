"use client";

import { METRIC_CONFIGS } from "@/components/invoices/metric-configs";
import type { MetricKey } from "@/lib/invoices/aggregate";
import { formatMoney } from "@/lib/invoices/money";

function formatMetric(key: MetricKey, value: number, currency: string): string {
  return METRIC_CONFIGS[key].kind === "money"
    ? formatMoney(Math.round(value * 100), currency)
    : value.toLocaleString("en-GB");
}

export function ChartTooltip({
  active,
  payload,
  label,
  currency = "GBP",
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string | number; value: number }>;
  label?: string;
  currency?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 shadow-md">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="space-y-1">
        {payload?.map((entry) => {
          const key = String(entry.dataKey) as MetricKey;
          const config = METRIC_CONFIGS[key];
          if (!config) return null;

          return (
            <li
              key={key}
              className="flex items-center justify-between gap-6 text-xs"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                  aria-hidden
                />
                <span className="text-muted-foreground">{config.name}</span>
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatMetric(key, Number(entry.value ?? 0), currency)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
