import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { OAuthCallbackScreen } from "@/features/auth/OAuthCallbackScreen";
import { validateInternalReturnTo } from "@/features/auth/auth-navigation";

const api = vi.hoisted(() => ({
  ApiError: class ApiError extends Error {},
  exchangeGoogleCode: vi.fn(),
  exchangeSteamCode: vi.fn(),
  getGoogleLoginUrl: vi.fn(),
  getGoogleStatus: vi.fn(),
  getSteamSignInUrl: vi.fn(),
  loginUser: vi.fn(),
  setToken: vi.fn(),
}));

vi.mock("@/lib/api", () => api);

describe("TanStack authentication handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    api.getGoogleStatus.mockResolvedValue({ configured: true });
  });

  it("accepts only same-origin internal return targets", () => {
    expect(
      validateInternalReturnTo("/friends/friend-id/messages?draft=hello"),
    ).toBe("/friends/friend-id/messages?draft=hello");
    expect(validateInternalReturnTo("https://evil.example/steal")).toBeNull();
    expect(validateInternalReturnTo("//evil.example/steal")).toBeNull();
    expect(validateInternalReturnTo("/\\evil.example/steal")).toBeNull();
  });

  it("returns to the requested profile after password login", async () => {
    const navigate = vi.fn();
    api.loginUser.mockResolvedValue({
      access_token: "password-token",
      token_type: "bearer",
    });

    render(
      <LoginScreen
        navigate={navigate}
        navigateExternal={vi.fn()}
        returnTo="/users/alex-public"
      />,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(api.setToken).toHaveBeenCalledWith("password-token"),
    );
    expect(navigate).toHaveBeenCalledWith("/users/alex-public");
  });

  it("preserves returnTo across an external OAuth round trip", async () => {
    const navigateExternal = vi.fn();
    api.getGoogleLoginUrl.mockResolvedValue({
      url: "https://accounts.google.test/oauth",
    });

    const login = render(
      <LoginScreen
        navigate={vi.fn()}
        navigateExternal={navigateExternal}
        returnTo="/friends/friend-id/messages"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    await waitFor(() =>
      expect(navigateExternal).toHaveBeenCalledWith(
        "https://accounts.google.test/oauth",
      ),
    );
    login.unmount();

    const navigate = vi.fn();
    api.exchangeGoogleCode.mockResolvedValue({
      access_token: "oauth-token",
      token_type: "bearer",
    });
    render(
      <OAuthCallbackScreen
        exchangeCode="exchange-code"
        navigate={navigate}
        provider="google"
      />,
    );

    await waitFor(() =>
      expect(api.setToken).toHaveBeenCalledWith("oauth-token"),
    );
    expect(navigate).toHaveBeenCalledWith("/friends/friend-id/messages");
    expect(window.sessionStorage.length).toBe(0);
  });
});
