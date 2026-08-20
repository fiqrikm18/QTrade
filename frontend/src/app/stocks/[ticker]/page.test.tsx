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
      risk_level: "low",
      regime: "trending_up",
      technical_indicators: {
        rsi_14: 52.5,
        macd: 1.2,
        macd_signal: 0.8,
        macd_hist: 0.4,
        sma_20: 10100,
        sma_50: 9800,
        sma_200: 9200,
        ema_20: 10200,
        atr_14: 210,
        adx_14: 31,
        boll_upper: 10800,
        boll_mid: 10100,
        boll_lower: 9400,
        roc_20: 4.2,
        rel_volume: 1.1,
        hist_vol_20: 0.18,
        stoch_k: 62,
        stoch_d: 55,
        asof: "2026-08-19",
      },
      components: {
        technical: 88,
        fundamental: 91,
        momentum: 62,
        relative_strength: 70,
        factor: 55,
        breadth_score: 48,
      },
      valuation: {
        per: 20,
        pbv: 2.5,
        psr: 192.5,
        ev_ebitda: 770.7,
        fcf_yield: 0.0004,
        dividend_yield: 0.025,
      },
      fundamental: {
        roe: 0.1333,
        roa: 0.0667,
        roic: 0.1009,
        npm: 0.2,
        gpm: 0.6,
        opm: 0.22,
        debt_equity: 0.2,
        current_ratio: 1.5,
        interest_coverage: 22,
      },
      smart_money: {
        score: 79,
        proxies: {
          accumulation_proxy: 55.2,
          volume_proxy: 48.1,
          structure_proxy: 33.3,
          rs_proxy: 62.5,
          liquidity_proxy: 90,
          vol_behavior_proxy: 51.7,
        },
      },
      risk_metrics: {
        hist_vol_20: 0.18,
        max_drawdown_250d: -0.12,
        avg_turnover_20d: 1.5e10,
        beta_vs_ihsg: null,
      },
      drivers: ["Strong relative strength"],
      risks: ["High valuation"],
      invalidation_conditions: ["Break below support"],
      asof: "2026-08-19",
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

  it("renders valuation, fundamental and smart-money data from analysis", async () => {
    render(<StockPage />);
    expect(await screen.findByText("20.00x")).toBeInTheDocument();
    expect(screen.getByText("2.50x")).toBeInTheDocument();
    expect(screen.getByText("13.3%")).toBeInTheDocument();
    expect(screen.getByText("2.50%")).toBeInTheDocument();
    expect(screen.getByText("55")).toBeInTheDocument();
    expect(screen.getByText("-12.0%")).toBeInTheDocument();
  });

  it("labels each component score bar", async () => {
    render(<StockPage />);
    expect(await screen.findByText("Relative Strength")).toBeInTheDocument();
    expect(screen.getByText("Momentum")).toBeInTheDocument();
    expect(screen.getByText("Factor")).toBeInTheDocument();
    expect(screen.getByText("Breadth")).toBeInTheDocument();
  });
});
