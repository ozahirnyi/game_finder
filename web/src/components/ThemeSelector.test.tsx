import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/theme", () => ({
  accents: [],
  useTheme: () => ({
    mode: "dark",
    accent: { id: "ember" },
    setMode: vi.fn(),
    setAccent: vi.fn(),
  }),
}));

import { ThemeSelector } from "./ThemeSelector";

describe("ThemeSelector", () => {
  it("fills a rounded segment for the selected theme", () => {
    render(<ThemeSelector />);

    const darkMode = screen.getByRole("button", { name: "Dark mode" });
    expect(darkMode).toHaveAttribute("aria-pressed", "true");
    expect(darkMode).toHaveClass("rounded-full", "bg-primary");
    expect(darkMode.parentElement).toHaveClass("rounded-full");
  });
});
