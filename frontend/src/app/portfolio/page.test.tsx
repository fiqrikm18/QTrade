import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PortfolioPage from "@/app/portfolio/page";
import { getPortfolio } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getPortfolio: vi.fn(),
  };
});

describe("PortfolioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPortfolio).mockResolvedValue([
      {
        id: "1",
        name: "My Portfolio",
        created_at: "2026-01-01T00:00:00Z",
        positions: [],
      },
    ]);
  });

  it("renders portfolios after loading", async () => {
    render(<PortfolioPage />);
    expect(await screen.findByText("My Portfolio")).toBeInTheDocument();
  });

  it("shows empty state when no portfolios exist", async () => {
    vi.mocked(getPortfolio).mockResolvedValue([]);
    render(<PortfolioPage />);
    expect(await screen.findByText("No portfolios yet")).toBeInTheDocument();
  });
});