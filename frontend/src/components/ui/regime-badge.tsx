import { Badge } from "./badge";
import { cn } from "@/lib/utils";

export type Regime = "trending_up" | "trending_down" | "ranging" | "volatile" | null;

interface RegimeBadgeProps {
  regime: Regime;
  className?: string;
}

const iconMap = {
  trending_up: "↗",
  trending_down: "↘",
  ranging: "↔",
  volatile: "⚡",
} as const;

const labelMap = {
  trending_up: "Trending Up",
  trending_down: "Trending Down",
  ranging: "Ranging",
  volatile: "Volatile",
  null: "Unknown",
} as const;

const colorMap = {
  trending_up: "bg-green-500/10 text-green-500",
  trending_down: "bg-destructive/10 text-destructive",
  ranging: "bg-blue-500/10 text-blue-500",
  volatile: "bg-purple-500/10 text-purple-500",
} as const;

export function RegimeBadge({ regime, className }: RegimeBadgeProps) {
  const label = labelMap[regime ?? "null"];
  const icon = regime ? iconMap[regime] : null;
  const customClass = regime ? colorMap[regime] : "bg-muted/50 text-muted-foreground";

  return (
    <Badge
      className={cn("text-[10px] border-transparent", customClass, className)}
    >
      {icon && <span className="mr-1">{icon}</span>}
      {label}
    </Badge>
  );
}