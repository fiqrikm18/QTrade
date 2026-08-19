import type { StockListItem } from "@/lib/api";

export function filterStocks(
  items: StockListItem[],
  query: string,
): StockListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.ticker.toLowerCase().includes(q) ||
      (item.name ?? "").toLowerCase().includes(q),
  );
}
