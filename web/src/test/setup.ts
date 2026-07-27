import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

export function renderWithProviders(ui: ReactElement) {
  return render(ui);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const apiMocks = {
  success: (body: unknown, status = 200) => jsonResponse(body, status),
  failure: (detail: string, status = 400) => jsonResponse({ detail }, status),
  fetch: (...responses: Response[]) =>
    vi
      .fn()
      .mockImplementation(async () => responses.shift() ?? jsonResponse({})),
};
