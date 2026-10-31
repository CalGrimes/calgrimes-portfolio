import { AlertTriangle, Landmark } from "lucide-react";

import { YTD_THRESHOLD_MINOR } from "@/lib/invoices/aggregate";
import { formatMoney } from "@/lib/invoices/money";
import { cn } from "@/lib/utils";

interface YtdThresholdCardProps {
  billedMinor: number;
  year: number;
  className?: string;
}

export function YtdThresholdCard({
  billedMinor,
  year,
  className,
}: YtdThresholdCardProps) {
  const ratio = billedMinor / YTD_THRESHOLD_MINOR;
  const percent = Math.min(ratio, 1) * 100;
  const crossed = billedMinor >= YTD_THRESHOLD_MINOR;
  const approaching = !crossed && ratio >= 0.8;
  const remaining = YTD_THRESHOLD_MINOR - billedMinor;

  return (
    <div className={cn("rounded-lg border bg-card p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            <Landmark className="h-3.5 w-3.5" aria-hidden />
            {`${year} billed to date`}
          </span>
          <div className="text-3xl font-semibold leading-none tracking-tight">
            {formatMoney(billedMinor)}
          </div>
        </div>

        {crossed || approaching ? (
          <span
            className={cn(
              "flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold",
              crossed
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {crossed ? "Threshold crossed" : "Approaching"}
          </span>
        ) : null}
      </div>

      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress toward the ${formatMoney(YTD_THRESHOLD_MINOR)} reporting threshold`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            crossed
              ? "bg-rose-500"
              : approaching
                ? "bg-amber-500"
                : "bg-emerald-500"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {crossed
          ? `${formatMoney(billedMinor - YTD_THRESHOLD_MINOR)} over the ${formatMoney(YTD_THRESHOLD_MINOR)} reporting threshold.`
          : `${formatMoney(remaining)} remaining before the ${formatMoney(YTD_THRESHOLD_MINOR)} reporting threshold.`}
      </p>
    </div>
  );
}
