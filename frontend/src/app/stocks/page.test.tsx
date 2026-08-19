import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StocksPage from "@/app/stocks/page";

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

  it("filters rows by search query", async () => {
    render(<StocksPage />);
    await screen.findByText("BBCA");
    fireEvent.change(
      screen.getByPlaceholderText("Search ticker or name..."),
      { target: { value: "telkom" } },
    );
    expect(screen.getByText("TLKM")).toBeInTheDocument();
    expect(screen.queryByText("BBCA")).not.toBeInTheDocument();
  });

  it("navigates to the detail page on row click", async () => {
    render(<StocksPage />);
    await screen.findByText("BBCA");
    fireEvent.click(screen.getByText("BBCA"));
    expect(push).toHaveBeenCalledWith("/stocks/BBCA");
  });
});
