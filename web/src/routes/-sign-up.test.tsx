import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ registerUser: vi.fn() }));

vi.mock("@/lib/api", () => ({ ApiError: class ApiError extends Error {}, ...api }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/sign-in">{children}</a>,
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/SocialAuthButtons", () => ({ SocialAuthButtons: () => null }));

import { Route } from "./sign-up";

describe("SignUpPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the sign-in handoff after email registration", async () => {
    api.registerUser.mockResolvedValue({ id: "user-1" });
    const SignUpPage = Route.options.component!;
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(api.registerUser).toHaveBeenCalledWith("me@example.com", "password"),
    );
    expect(screen.getByText(/account created/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows a registration error", async () => {
    api.registerUser.mockRejectedValue(new Error("Email already registered"));
    const SignUpPage = Route.options.component!;
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email already registered");
  });
});
