import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceChange } from "@/components/ui/price-change";

describe("PriceChange", () => {
  it("formats positive change with plus sign", () => {
    render(<PriceChange changePct={1.42} />);

    expect(screen.getByText("+1.42%")).toBeInTheDocument();
  });

  it("formats negative change with minus sign", () => {
    render(<PriceChange changePct={-0.39} />);

    expect(screen.getByText("-0.39%")).toBeInTheDocument();
  });

  it("applies positive token class for gains", () => {
    render(<PriceChange changePct={1.42} />);

    const el = screen.getByText("+1.42%");
    expect(el.className).toMatch(/text-(positive|green)/);
    expect(el.className).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it("applies negative token class for losses", () => {
    render(<PriceChange changePct={-0.39} />);

    const el = screen.getByText("-0.39%");
    expect(el.className).toMatch(/text-(negative|red)/);
  });

  it("renders zero change with neutral token class", () => {
    render(<PriceChange changePct={0} />);

    const el = screen.getByText("0.00%");
    expect(el.className).toMatch(/text-(muted|neutral|foreground)/);
  });
});