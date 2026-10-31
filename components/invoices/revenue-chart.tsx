"use client";

import * as React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/invoices/chart-tooltip";
import { METRIC_CONFIGS } from "@/components/invoices/metric-configs";
import { Button } from "@/components/ui/button";
import type { MetricKey, SeriesPoint } from "@/lib/invoices/aggregate";

const AXIS_TICK = {
  fontSize: 10,
  fill: "hsl(var(--muted-foreground))",
  fontWeight: 400,
};

const AXIS_LINE = { stroke: "hsl(var(--border))", strokeWidth: 0.5 };

function compact(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
}

interface RevenueChartProps {
  data: SeriesPoint[];
  visibleMetrics: MetricKey[];
  onToggleMetric: (metric: MetricKey) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showDataPoints: boolean;
  onToggleDataPoints: () => void;
  currency?: string;
}

export function RevenueChart({
  data,
  visibleMetrics,
  onToggleMetric,
  showGrid,
  onToggleGrid,
  showDataPoints,
  onToggleDataPoints,
  currency = "GBP",
}: RevenueChartProps) {
  const keys = Object.keys(METRIC_CONFIGS) as MetricKey[];

  const hasLeft = keys.some(
    (key) => visibleMetrics.includes(key) && METRIC_CONFIGS[key].yAxis === "left"
  );
  const hasRight = keys.some(
    (key) =>
      visibleMetrics.includes(key) && METRIC_CONFIGS[key].yAxis === "right"
  );

  const lines = React.useMemo(
    () =>
      keys.map((key) => {
        const config = METRIC_CONFIGS[key];
        return (
          <Line
            key={key}
            yAxisId={config.yAxis}
            type="monotone"
            dataKey={key}
            stroke={config.color}
            strokeWidth={1.75}
            dot={
              showDataPoints
                ? { fill: config.color, strokeWidth: 1, r: 1.5 }
                : false
            }
            activeDot={
              showDataPoints
                ? { r: 3, stroke: config.color, strokeWidth: 1 }
                : false
            }
            isAnimationActive={false}
            hide={!visibleMetrics.includes(key)}
          />
        );
      }),
    [visibleMetrics, showDataPoints]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <div className="flex flex-wrap gap-1">
          {keys.map((key) => (
            <Button
              key={key}
              variant={visibleMetrics.includes(key) ? "default" : "outline"}
              size="sm"
              onClick={() => onToggleMetric(key)}
              className="h-7 px-2 text-xs"
            >
              {METRIC_CONFIGS[key].name}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          <Button
            variant={showGrid ? "default" : "outline"}
            size="sm"
            onClick={onToggleGrid}
            className="h-7 px-2 text-xs"
          >
            Grid
          </Button>
          <Button
            variant={showDataPoints ? "default" : "outline"}
            size="sm"
            onClick={onToggleDataPoints}
            className="h-7 px-2 text-xs"
          >
            Points
          </Button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data}>
          {showGrid ? (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
          ) : null}
          <XAxis
            dataKey="dateFormatted"
            tick={AXIS_TICK}
            axisLine={AXIS_LINE}
            tickLine={false}
          />
          {hasLeft ? (
            <YAxis
              yAxisId="left"
              hide={!hasLeft}
              tick={AXIS_TICK}
              axisLine={AXIS_LINE}
              tickLine={false}
              tickFormatter={compact}
            />
          ) : null}
          {hasRight ? (
            <YAxis
              yAxisId="right"
              orientation="right"
              hide={!hasRight}
              tick={AXIS_TICK}
              axisLine={AXIS_LINE}
              tickLine={false}
              tickFormatter={compact}
            />
          ) : null}
          <Tooltip content={<ChartTooltip currency={currency} />} />
          <Legend
            verticalAlign="top"
            height={24}
            onClick={(e) => {
              if (e.dataKey && typeof e.dataKey === "string") {
                onToggleMetric(e.dataKey as MetricKey);
              }
            }}
          />
          {lines}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
