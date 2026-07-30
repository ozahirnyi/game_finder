import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
import { Route } from "./search";

describe("SearchPage", () => {
  it("submits an AI prompt and displays returned recommendations", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ recommendations: [{ title: "Recommended title", reason: "Fits your prompt", tags: ["Co-op"] }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const SearchPage = Route.options.component!;
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SearchPage /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: /ai search/i }));
    const prompt = await screen.findByPlaceholderText(/describe what you want/i);
    fireEvent.change(prompt, { target: { value: "co-op games for two" } });
    fireEvent.submit(screen.getByRole("form", { name: /search form/i }));
    expect(await screen.findByText("Recommended title")).toBeInTheDocument();
    expect(screen.getByText("Fits your prompt")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/recommendations"), expect.any(Object));
  });
});
