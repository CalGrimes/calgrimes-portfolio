import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";

import type { MetricData } from "@/lib/invoices/aggregate";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  metric: MetricData;
  icon?: LucideIcon;
  accentColor?: string;
  formatValue?: (value: number) => string;
  size?: "primary" | "secondary";
  className?: string;
}

export function MetricCard({
  title,
  metric,
  icon: Icon,
  accentColor,
  formatValue = (value) => value.toLocaleString("en-GB"),
  size = "secondary",
  className,
}: MetricCardProps) {
  const isPrimary = size === "primary";
  const hasComparison = metric.previous !== 0;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
        {Icon ? (
          <Icon
            className="h-3.5 w-3.5"
            style={accentColor ? { color: accentColor } : undefined}
            aria-hidden
          />
        ) : null}
        {title}
      </span>

      <div
        className={cn(
          "font-semibold leading-none tracking-tight text-foreground",
          isPrimary ? "text-3xl" : "text-xl"
        )}
      >
        {formatValue(metric.current)}
      </div>

      {hasComparison ? (
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className={cn(
              "flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-semibold",
              metric.trend === "up" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              metric.trend === "down" && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
              metric.trend === "neutral" && "bg-muted text-muted-foreground"
            )}
          >
            {metric.trend === "up" ? (
              <ArrowUp className="h-3 w-3" aria-hidden />
            ) : metric.trend === "down" ? (
              <ArrowDown className="h-3 w-3" aria-hidden />
            ) : null}
            {`${metric.change > 0 ? "+" : ""}${metric.change.toFixed(1)}%`}
          </span>
          <span className="text-xs text-muted-foreground">
            vs previous period
          </span>
        </div>
      ) : (
        <span className="mt-0.5 text-xs text-muted-foreground">
          No prior period
        </span>
      )}
    </div>
  );
}
