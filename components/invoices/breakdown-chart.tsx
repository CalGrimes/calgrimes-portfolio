"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { BreakdownRow, MetricKey } from "@/lib/invoices/aggregate";
import { formatMoney } from "@/lib/invoices/money";
import { cn } from "@/lib/utils";

interface BreakdownChartProps {
  data: BreakdownRow[];
  color?: string;
  currency?: string;
  className?: string;
}

const AXIS_TICK = {
  fontSize: 10,
  fill: "hsl(var(--muted-foreground))",
  fontWeight: 400,
};

const AXIS_LINE = { stroke: "hsl(var(--border))", strokeWidth: 0.5 };

export function BreakdownChart({
  data,
  color = "#0EA5E9",
  currency = "GBP",
  className,
}: BreakdownChartProps) {
  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 20, left: 120, bottom: 0 }}
        >
          <XAxis
            type="number"
            tick={AXIS_TICK}
            axisLine={AXIS_LINE}
            tickLine={false}
          />
          <YAxis
            dataKey="label"
            type="category"
            width={110}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={AXIS_LINE}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.375rem",
            }}
            formatter={(value: number) => formatMoney(Math.round(value), currency)}
            labelStyle={{ color: "hsl(var(--muted-foreground))" }}
          />
          <Bar
            dataKey="billedMinor"
            fill={color}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
