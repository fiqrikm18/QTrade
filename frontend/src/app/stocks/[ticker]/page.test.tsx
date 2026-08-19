import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StockPage from "@/app/stocks/[ticker]/page";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ ticker: "BBCA" }),
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getStockAnalysis: vi.fn().mockResolvedValue({
      ticker: "BBCA",
      name: "Bank Central Asia",
      price: 10400,
      change: 100,
      change_pct: 0.97,
      opportunity_score: 86.5,
      classification: "OPPORTUNITY",
      components: { technical: 88, fundamental: 91 },
      drivers: ["Strong relative strength"],
      risks: ["High valuation"],
      invalidation_conditions: ["Break below support"],
    }),
    getTechnicalIndicators: vi.fn().mockResolvedValue({
      ticker: "BBCA",
      rsi_14: 52.5,
      macd: 1.2,
    }),
    getStocks: vi.fn().mockImplementation((page = 1, pageSize = 20) => {
      const items = universeItems.slice(0, pageSize);
      return Promise.resolve({
        items,
        total: universeItems.length,
        page,
        page_size: pageSize,
      });
    }),
  };
});

const universeItems = [
  { ticker: "BBCA", name: "Bank Central Asia", board: "Utama" },
  { ticker: "TLKM", name: "Telkom Indonesia", board: "Utama" },
  ...Array.from({ length: 98 }, (_, i) => ({
    ticker: `T${String(i + 2).padStart(3, "0")}`,
    name: "Filler",
    board: "Utama",
  })),
  { ticker: "ZOOM", name: "Zoom Test", board: "Utama" },
];

describe("StockPage ticker selector", () => {
  it("shows the current ticker preselected in the selector", async () => {
    render(<StockPage />);
    expect(
      await screen.findByTestId("ticker-select-trigger"),
    ).toHaveTextContent("BBCA");
  });

  it("navigates to the selected ticker", async () => {
    render(<StockPage />);
    fireEvent.click(await screen.findByTestId("ticker-select-trigger"));
    fireEvent.click(screen.getByText("TLKM", { exact: false }));
    expect(push).toHaveBeenCalledWith("/stocks/TLKM");
  });

  it("exposes tickers beyond the first 100 in the selector", async () => {
    render(<StockPage />);
    fireEvent.click(await screen.findByTestId("ticker-select-trigger"));
    expect(screen.getByText("ZOOM")).toBeInTheDocument();
    fireEvent.click(screen.getByText("ZOOM"));
    expect(push).toHaveBeenCalledWith("/stocks/ZOOM");
  });
});
