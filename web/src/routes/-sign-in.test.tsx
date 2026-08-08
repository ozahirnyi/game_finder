import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ loginUser: vi.fn(), setToken: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {},
  ...api,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => navigate,
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/SocialAuthButtons", () => ({ SocialAuthButtons: () => null }));

import { Route } from "./sign-in";

describe("SignInPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("stores the token and navigates to the account after email sign-in", async () => {
    api.loginUser.mockResolvedValue({ access_token: "token" });
    const SignInPage = Route.options.component!;
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(api.setToken).toHaveBeenCalledWith("token"));
    expect(navigate).toHaveBeenCalledWith({ to: "/account" });
  });

  it("shows an invalid-credential error and re-enables submission", async () => {
    api.loginUser.mockRejectedValue(new Error("Invalid credentials"));
    const SignInPage = Route.options.component!;
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
    expect(screen.getByRole("button", { name: /sign in/i })).not.toBeDisabled();
  });
});
