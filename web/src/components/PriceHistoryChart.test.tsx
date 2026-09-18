// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PriceHistoryChart } from "./PriceHistoryChart";

describe("PriceHistoryChart", () => {
  afterEach(cleanup);
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

  it("reports unavailable history without inventing a current price", () => {
    const { container } = render(<PriceHistoryChart points={[]} historyAvailable={false} />);

    expect(within(container).getByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(within(container).queryByText(/current price/i)).not.toBeInTheDocument();
  });

  it("renders a readable single observation", () => {
    render(
      <PriceHistoryChart
        currency="USD"
        points={[{ date: "2025-09-25T00:00:00+00:00", price: 19.99 }]}
      />,
    );

    fireEvent.focus(screen.getByRole("button", { name: /25 Sep.*sale/i }));

    expect(screen.getByRole("tooltip")).toHaveTextContent(/25 Sep.*Sale price: \$19\.99/i);
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

  it("formats the historical low in the point currency", () => {
    render(
      <PriceHistoryChart
        currency="UAH"
        points={[
          { date: "2025-08-01T00:00:00+00:00", price: 13, currency: "USD" },
          { date: "2025-09-25T00:00:00+00:00", price: 20, currency: "USD" },
        ]}
      />,
    );

    expect(screen.getByText("$13.00")).toBeInTheDocument();
    expect(screen.queryByText(/₴13/)).not.toBeInTheDocument();
  });

  it("uses stepped sale and regular-price lines and exposes each point by hover and keyboard", () => {
    render(
      <PriceHistoryChart
        currency="USD"
        points={[
          { date: "2025-08-01T00:00:00+00:00", price: 19.99, regular: 29.99 },
          { date: "2025-09-25T00:00:00+00:00", price: 24.99, regular: 29.99 },
        ]}
      />,
    );

    expect(screen.getByLabelText("Sale price history")).toHaveAttribute("d", expect.stringContaining("H"));
    expect(screen.getByLabelText("Regular price history")).toBeInTheDocument();
    const firstPoint = screen.getByRole("button", { name: /1 Aug.*sale/i });
    fireEvent.mouseEnter(firstPoint);
    expect(screen.getByRole("tooltip")).toHaveTextContent(/Regular price: \$29\.99/i);
    fireEvent.focus(screen.getByRole("button", { name: /25 Sep.*sale/i }));
    expect(screen.getByRole("tooltip")).toHaveTextContent(/25 Sep.*Sale price: \$24\.99/i);
  });
});
