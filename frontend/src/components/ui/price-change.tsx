import { cn } from "@/lib/utils";

export interface PriceChangeProps {
  changePct: number;
}

function changeTone(v: number): string {
  if (v > 0) return "text-positive";
  if (v < 0) return "text-negative";
  return "text-muted-foreground";
}

export function PriceChange({ changePct }: PriceChangeProps) {
  const sign = changePct > 0 ? "+" : "";
  return (
    <span className={cn("font-medium tabular-nums", changeTone(changePct))}>
      {sign}
      {changePct.toFixed(2)}%
    </span>
  );
}