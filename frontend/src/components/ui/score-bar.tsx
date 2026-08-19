import { cn } from "@/lib/utils";

export interface ScoreBarProps {
  score: number | null | undefined;
  classification?: string;
  confidence?: number;
}

function scoreTone(score: number): string {
  if (score >= 60) return "text-positive";
  if (score >= 40) return "text-warning";
  return "text-negative";
}

export function ScoreBar({ score, classification, confidence }: ScoreBarProps) {
  if (score == null) {
    return (
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("text-2xl font-bold", "text-muted-foreground")}>
            —
          </span>
          {classification && (
            <span className="text-xs font-medium text-foreground">
              {classification}
            </span>
          )}
          {confidence !== undefined && (
            <span className="text-xs text-muted-foreground">
              {confidence.toFixed(0)}%
            </span>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-muted-foreground/30" style={{ width: "0%" }} />
        </div>
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("text-2xl font-bold", scoreTone(score))}>
          {score.toFixed(1)}
        </span>
        {classification && (
          <span className="text-xs font-medium text-foreground">
            {classification}
          </span>
        )}
        {confidence !== undefined && (
          <span className="text-xs text-muted-foreground">
            {confidence.toFixed(0)}%
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          data-testid="score-bar-fill"
          className="h-full rounded-full bg-primary"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}