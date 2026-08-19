import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TickerSelect } from "@/components/ui/ticker-select";
import type { StockListItem } from "@/lib/api";

const options: StockListItem[] = [
  { ticker: "BBCA", name: "Bank Central Asia", board: "Utama" },
  { ticker: "TLKM", name: "Telkom Indonesia", board: "Utama" },
  { ticker: "BBRI", name: "Bank Rakyat Indonesia", board: "Utama" },
];

describe("TickerSelect", () => {
  it("shows the current value in the trigger", () => {
    render(<TickerSelect options={options} value="BBCA" onSelect={() => {}} />);
    expect(screen.getByTestId("ticker-select-trigger")).toHaveTextContent(
      "BBCA",
    );
  });

  it("filters options by search query", () => {
    render(<TickerSelect options={options} value="BBCA" onSelect={() => {}} />);
    fireEvent.click(screen.getByTestId("ticker-select-trigger"));
    fireEvent.change(screen.getByPlaceholderText("Search ticker or name..."), {
      target: { value: "telkom" },
    });
    expect(screen.getByText("TLKM", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("BBRI", { exact: false })).not.toBeInTheDocument();
  });

  it("calls onSelect with the chosen ticker", () => {
    const onSelect = vi.fn();
    render(<TickerSelect options={options} value="BBCA" onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("ticker-select-trigger"));
    fireEvent.click(screen.getByText("TLKM", { exact: false }));
    expect(onSelect).toHaveBeenCalledWith("TLKM");
  });
});
