import { Badge } from "./badge";
import { cn } from "@/lib/utils";

export type ImpactLevel = "HIGH" | "MEDIUM" | "LOW" | null;

interface ImpactBadgeProps {
  impact: ImpactLevel;
  className?: string;
}

const variantMap = {
  HIGH: "destructive" as const,
  MEDIUM: "warning" as const,
  LOW: "neutral" as const,
};

const labelMap = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  null: "Unknown",
} as const;

export function ImpactBadge({ impact, className }: ImpactBadgeProps) {
  const variant = impact ? variantMap[impact] : "secondary";
  const label = labelMap[impact ?? "null"];

  return (
    <Badge
      variant={variant as "destructive" | "warning" | "neutral" | "secondary"}
      className={cn("text-[10px]", className)}
    >
      {label}
    </Badge>
  );
}