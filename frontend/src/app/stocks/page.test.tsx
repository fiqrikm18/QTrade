import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StocksPage from "@/app/stocks/page";
import { getStocks } from "@/lib/api";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getStocks: vi.fn().mockResolvedValue({
      items: [
        { ticker: "BBCA", name: "Bank Central Asia", board: "Utama" },
        { ticker: "TLKM", name: "Telkom Indonesia", board: "Utama" },
      ],
      total: 2,
      page: 1,
      page_size: 20,
    }),
  };
});

describe("StocksPage", () => {
  it("renders the universe table after loading", async () => {
    render(<StocksPage />);
    expect(await screen.findByText("BBCA")).toBeInTheDocument();
    expect(screen.getByText("Bank Central Asia")).toBeInTheDocument();
  });

  it("searches the server when typing a query", async () => {
    vi.mocked(getStocks).mockImplementation(async (_page, _size, search) => {
      const all = [
        { ticker: "BBCA", name: "Bank Central Asia", board: "Utama" },
        { ticker: "TLKM", name: "Telkom Indonesia", board: "Utama" },
      ];
      const q = (search ?? "").trim().toLowerCase();
      const items = all.filter(
        (s) =>
          s.ticker.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q),
      );
      return { items, total: items.length, page: 1, page_size: 20 };
    });

    render(<StocksPage />);
    await screen.findByText("BBCA");
    fireEvent.change(
      screen.getByPlaceholderText("Search ticker or name..."),
      { target: { value: "telkom" } },
    );

    await waitFor(() =>
      expect(getStocks).toHaveBeenCalledWith(1, 20, "telkom"),
    );
    expect(await screen.findByText("TLKM")).toBeInTheDocument();
  });

  it("navigates to the detail page on row click", async () => {
    render(<StocksPage />);
    await screen.findByText("BBCA");
    fireEvent.click(screen.getByText("BBCA"));
    expect(push).toHaveBeenCalledWith("/stocks/BBCA");
  });
});