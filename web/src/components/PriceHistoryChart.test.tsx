// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PriceHistoryChart } from "./PriceHistoryChart";

describe("PriceHistoryChart", () => {
  it("explains an empty normalized history", () => {
    render(<PriceHistoryChart points={[]} currency="USD" />);

    expect(screen.getByText("No price history is available yet.")).toBeInTheDocument();
  });

  it("reports unavailable history instead of claiming no price changes for a current-price fallback", () => {
    render(
      <PriceHistoryChart
        points={[]}
        currency="USD"
        currentPrice={19.79}
        historyAvailable={false}
      />,
    );

    expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/no price changes/i)).not.toBeInTheDocument();
  });

  it("renders a readable single observation", () => {
    render(
      <PriceHistoryChart
        currency="USD"
        points={[{ date: "2025-09-25T00:00:00+00:00", price: 19.99 }]}
      />,
    );

    expect(screen.getByText("Recorded 25 Sep at $19.99.")).toBeInTheDocument();
  });

  it("renders an accessible graph with endpoint labels and the historical low", () => {
    render(
      <PriceHistoryChart
        currency="USD"
        points={[
          { date: "2025-08-01T00:00:00+00:00", price: 19.99 },
          { date: "2025-09-25T00:00:00+00:00", price: 24.99 },
        ]}
      />,
    );

    expect(screen.getByLabelText("Price history chart")).toBeInTheDocument();
    expect(screen.getByText("1 Aug")).toBeInTheDocument();
    expect(screen.getByText("25 Sep")).toBeInTheDocument();
    expect(screen.getByText("Historical low")).toBeInTheDocument();
    expect(screen.getByText("$19.99")).toBeInTheDocument();
  });
});
