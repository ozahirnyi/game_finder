import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ registerUser: vi.fn(), loginUser: vi.fn(), setToken: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({ ApiError: class ApiError extends Error {}, ...api }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/sign-in">{children}</a>,
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => navigate,
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

  it("signs in and opens the account after email registration", async () => {
    api.registerUser.mockResolvedValue({ id: "user-1" });
    api.loginUser.mockResolvedValue({ access_token: "new-user-token" });
    const SignUpPage = Route.options.component!;
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(api.setToken).toHaveBeenCalledWith("new-user-token"));
    expect(api.registerUser).toHaveBeenCalledWith("me@example.com", "password");
    expect(api.loginUser).toHaveBeenCalledWith("me@example.com", "password");
    expect(navigate).toHaveBeenCalledWith({ to: "/account" });
  });

  it("keeps a clear sign-in path when account creation succeeds but automatic sign-in fails", async () => {
    api.registerUser.mockResolvedValue({ id: "user-1" });
    api.loginUser.mockRejectedValue(new Error("Login unavailable"));
    const SignUpPage = Route.options.component!;
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " Me@Example.com " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/account created.*sign in/i);
    expect(api.loginUser).toHaveBeenCalledWith("Me@Example.com", "password");
    expect(api.setToken).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();
  });

  it("shows a registration error", async () => {
    api.registerUser.mockRejectedValue(new Error("Email already registered"));
    const SignUpPage = Route.options.component!;
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email already registered");
    expect(api.loginUser).not.toHaveBeenCalled();
  });

  it.each([
    ["", "password123", /email is required/i],
    ["   ", "password123", /email is required/i],
    ["not-an-email", "password123", /valid email/i],
    ["name@", "password123", /valid email/i],
    ["a..b@example.com", "password123", /valid email/i],
    ["a@example..com", "password123", /valid email/i],
    ["me@example.com", "", /password is required/i],
    ["me@example.com", "        ", /password is required/i],
    ["me@example.com", "short", /at least 8 characters/i],
    ["me@example.com", "😀".repeat(4), /at least 8 characters/i],
    ["me@example.com", "é".repeat(37), /72 bytes/i],
  ])("blocks invalid registration input %#", async (email, password, message) => {
    const SignUpPage = Route.options.component!;
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(api.registerUser).not.toHaveBeenCalled();
  });
});
