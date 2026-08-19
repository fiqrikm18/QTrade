import { cn } from "@/lib/utils";

export type SkeletonVariant = "table-row" | "card" | "list-item" | "table";

interface LoadingSkeletonProps {
  variant: SkeletonVariant;
  rows?: number;
  columns?: number;
  className?: string;
}

export function LoadingSkeleton({
  variant,
  rows = 5,
  columns = 6,
  className,
}: LoadingSkeletonProps) {
  const baseClass = "skeleton";

  switch (variant) {
    case "table-row":
      return (
        <div className={cn(baseClass, className)} role="status" aria-label="Loading table rows">
          {[...Array(rows)].map((_, rowIndex) => (
            <div key={rowIndex} className="flex gap-3 py-2">
              {[...Array(columns)].map((_, colIndex) => (
                <div
                  key={colIndex}
                  className={cn(
                    "h-4 rounded",
                    colIndex === 0 ? "w-20" : "w-16",
                    colIndex === columns - 1 && "w-24"
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      );

    case "table":
      return (
        <div className={cn(baseClass, className)} role="status" aria-label="Loading table">
          <div className="flex gap-3 px-3 py-2 border-b border-border">
            {[...Array(columns)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-4 rounded font-medium",
                  i === 0 ? "w-20" : i === columns - 1 ? "w-24" : "w-16"
                )}
              />
            ))}
          </div>
          {[...Array(rows)].map((_, rowIndex) => (
            <div key={rowIndex} className="flex gap-3 px-3 py-2 border-b border-border">
              {[...Array(columns)].map((_, colIndex) => (
                <div
                  key={colIndex}
                  className={cn(
                    "h-4 rounded",
                    colIndex === 0 ? "w-20" : "w-16",
                    colIndex === columns - 1 && "w-24"
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      );

    case "card":
      return (
        <div className={cn(baseClass, "panel p-4 space-y-3", className)} role="status" aria-label="Loading card">
          <div className="h-5 w-3/4 rounded" />
          <div className="h-8 w-1/2 rounded" />
          <div className="h-4 w-full rounded" />
          <div className="h-4 w-2/3 rounded" />
          <div className="flex gap-2 mt-2">
            <div className="h-6 w-16 rounded-full" />
            <div className="h-6 w-16 rounded-full" />
          </div>
        </div>
      );

    case "list-item":
      return (
        <div className={cn(baseClass, className)} role="status" aria-label="Loading list">
          {[...Array(rows)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-border">
              <div className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded" />
                <div className="h-3 w-1/2 rounded" />
              </div>
              <div className="h-4 w-20 rounded text-right" />
            </div>
          ))}
        </div>
      );

    default:
      return null;
  }
}