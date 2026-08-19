import { Badge } from "./badge";
import { cn } from "@/lib/utils";

export type RiskLevel = "low" | "medium" | "high" | null;

interface RiskLevelBadgeProps {
  level: RiskLevel;
  className?: string;
}

const colorMap = {
  low: "bg-green-500/10 text-green-500",
  medium: "bg-warning/10 text-warning",
  high: "bg-destructive/10 text-destructive",
} as const;

const labelMap = {
  low: "Low",
  medium: "Medium",
  high: "High",
  null: "Unknown",
} as const;

export function RiskLevelBadge({ level, className }: RiskLevelBadgeProps) {
  const label = labelMap[level ?? "null"];
  const customClass = level ? colorMap[level] : "bg-muted/50 text-muted-foreground";

  return (
    <Badge
      className={cn("text-[10px] border-transparent", customClass, className)}
    >
      {label}
    </Badge>
  );
}