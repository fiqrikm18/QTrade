import { cn } from "@/lib/utils";
import { Button } from "./button";

export type EmptyStateIcon = 
  | "search" 
  | "filter" 
  | "database" 
  | "chart" 
  | "alert" 
  | "folder" 
  | "users" 
  | "settings"
  | "clock"
  | "wifi-off"
  | "shield";

const iconMap: Record<EmptyStateIcon, string> = {
  search: "🔍",
  filter: "🔎",
  database: "🗄️",
  chart: "📊",
  alert: "⚠️",
  folder: "📁",
  users: "👥",
  settings: "⚙️",
  clock: "🕐",
  "wifi-off": "📡",
  shield: "🛡️",
};

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
  };
  icon?: EmptyStateIcon;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon = "database",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "empty-state",
        "flex flex-col items-center justify-center",
        "py-12 px-6",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="empty-state-icon" aria-hidden="true">
        {iconMap[icon]}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && (
        <p className="empty-state-message text-muted-foreground max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant={action.variant || "default"}
          size="sm"
          onClick={action.onClick}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}