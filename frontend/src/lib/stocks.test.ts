import { describe, expect, it } from "vitest";
import { filterStocks } from "@/lib/stocks";
import type { StockListItem } from "@/lib/api";

const items: StockListItem[] = [
  { ticker: "BBCA", name: "Bank Central Asia", board: "Utama" },
  { ticker: "BBRI", name: "Bank Rakyat Indonesia", board: "Utama" },
  { ticker: "TLKM", name: "Telkom Indonesia", board: "Utama" },
];

describe("filterStocks", () => {
  it("returns all items for an empty or whitespace query", () => {
    expect(filterStocks(items, "")).toHaveLength(3);
    expect(filterStocks(items, "   ")).toHaveLength(3);
  });

  it("matches ticker case-insensitively", () => {
    expect(filterStocks(items, "bbca").map((i) => i.ticker)).toEqual(["BBCA"]);
  });

  it("matches name case-insensitively", () => {
    expect(filterStocks(items, "telkom").map((i) => i.ticker)).toEqual(["TLKM"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterStocks(items, "zzz")).toEqual([]);
  });
});
