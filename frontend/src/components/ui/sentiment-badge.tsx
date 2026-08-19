import { Badge } from "./badge";
import { cn } from "@/lib/utils";

export type Sentiment = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | null;

interface SentimentBadgeProps {
  sentiment: Sentiment;
  className?: string;
}

const variantMap = {
  POSITIVE: "success" as const,
  NEGATIVE: "destructive" as const,
  NEUTRAL: "neutral" as const,
};

const labelMap = {
  POSITIVE: "POSITIVE",
  NEGATIVE: "NEGATIVE",
  NEUTRAL: "NEUTRAL",
  null: "Unknown",
} as const;

export function SentimentBadge({ sentiment, className }: SentimentBadgeProps) {
  const variant = sentiment ? variantMap[sentiment] : "secondary";
  const label = labelMap[sentiment ?? "null"];

  return (
    <Badge
      variant={variant as "success" | "destructive" | "neutral" | "secondary"}
      className={cn("text-[10px]", className)}
    >
      {label}
    </Badge>
  );
}