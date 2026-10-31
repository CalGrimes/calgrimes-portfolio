import {
  Banknote,
  CircleDollarSign,
  Clock,
  FileText,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import type { MetricKey } from "@/lib/invoices/aggregate";

export type MetricConfig = {
  color: string;
  name: string;
  icon: LucideIcon;
  description: string;
  yAxis: "left" | "right";
  kind: "money" | "count";
};

export const METRIC_CONFIGS: Record<MetricKey, MetricConfig> = {
  billed: {
    color: "#0EA5E9",
    name: "Billed",
    icon: Banknote,
    description: "Total value of invoices issued",
    yAxis: "left",
    kind: "money",
  },
  paid: {
    color: "#10B981",
    name: "Paid",
    icon: CircleDollarSign,
    description: "Value of invoices marked paid",
    yAxis: "left",
    kind: "money",
  },
  outstanding: {
    color: "#F59E0B",
    name: "Outstanding",
    icon: Clock,
    description: "Sent or overdue and not yet paid",
    yAxis: "left",
    kind: "money",
  },
  count: {
    color: "#8B5CF6",
    name: "Invoices",
    icon: FileText,
    description: "Number of invoices issued",
    yAxis: "right",
    kind: "count",
  },
  avgInvoice: {
    color: "#F43F5E",
    name: "Avg invoice",
    icon: TrendingUp,
    description: "Mean invoice value",
    yAxis: "right",
    kind: "money",
  },
};

export const DEFAULT_VISIBLE_METRICS: MetricKey[] = [
  "billed",
  "paid",
  "outstanding",
];
