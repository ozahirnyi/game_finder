import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { PsnImportFlow } from "./PsnImportFlow";

describe("PsnImportFlow", () => {
  it("starts with an export upload action", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PsnImportFlow />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/choose an export file/i)).toBeInTheDocument();
  });
});
