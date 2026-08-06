import { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthScreen } from "./AuthScreen";

const api = vi.hoisted(() => ({
  ApiError: class ApiError extends Error {},
  loginUser: vi.fn(),
  registerUser: vi.fn(),
}));
const session = vi.hoisted(() => ({ completeLogin: vi.fn() }));

vi.mock("@/lib/api", () => api);
vi.mock("@/lib/auth-session", () => session);

describe("AuthScreen", () => {
  const onSuccess = vi.fn();
  const queryClient = new QueryClient();

  beforeEach(() => vi.clearAllMocks());

  it("logs in and navigates home", async () => {
    api.loginUser.mockResolvedValue({
      access_token: "token",
      token_type: "bearer",
    });
    render(
      <AuthScreen
        mode="login"
        queryClient={queryClient}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(session.completeLogin).toHaveBeenCalledWith("token", queryClient),
    );
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("shows the API error and re-enables the form", async () => {
    api.loginUser.mockRejectedValue(new api.ApiError("Invalid credentials"));
    render(
      <AuthScreen
        mode="login"
        queryClient={queryClient}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid credentials",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("registers before logging in", async () => {
    api.registerUser.mockResolvedValue({});
    api.loginUser.mockResolvedValue({
      access_token: "token",
      token_type: "bearer",
    });
    render(
      <AuthScreen
        mode="register"
        queryClient={queryClient}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(api.loginUser).toHaveBeenCalled());
    expect(api.registerUser.mock.invocationCallOrder[0]).toBeLessThan(
      api.loginUser.mock.invocationCallOrder[0],
    );
  });
});
