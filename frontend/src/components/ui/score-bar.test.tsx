import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreBar } from "@/components/ui/score-bar";

describe("ScoreBar", () => {
  it("renders score, classification, and confidence", () => {
    render(
      <ScoreBar score={72.4} classification="WATCHLIST" confidence={65} />,
    );

    expect(screen.getByText("72.4")).toBeInTheDocument();
    expect(screen.getByText("WATCHLIST")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("applies token classes instead of hardcoded hex colors", () => {
    render(
      <ScoreBar score={86} classification="OPPORTUNITY" confidence={90} />,
    );

    const score = screen.getByText("86.0");
    expect(score.className).toMatch(/text-(positive|green)/);
    expect(score.className).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it("uses negative token class for low scores", () => {
    render(<ScoreBar score={12} classification="AVOID" confidence={20} />);

    const score = screen.getByText("12.0");
    expect(score.className).toMatch(/text-(negative|red)/);
  });

  it("renders a progress bar with width proportional to score", () => {
    render(<ScoreBar score={50} classification="NEUTRAL" confidence={50} />);

    const bar = document.querySelector('[data-testid="score-bar-fill"]');
    expect(bar).not.toBeNull();
    expect(bar).toHaveStyle({ width: "50%" });
  });
});