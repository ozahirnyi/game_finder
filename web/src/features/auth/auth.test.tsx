import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPanel } from "./AuthPanel";

const api = vi.hoisted(() => ({
  ApiError: class ApiError extends Error {},
  getGoogleLoginUrl: vi.fn(),
  getGoogleStatus: vi.fn(),
  getSteamSignInUrl: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  setToken: vi.fn(),
}));

const navigate = vi.fn();

vi.mock("@/lib/api", () => api);
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => navigate,
}));

describe("AuthPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getGoogleStatus.mockResolvedValue({ configured: true });
  });

  it("submits credentials and stores the returned token", async () => {
    api.loginUser.mockResolvedValue({
      access_token: "token",
      token_type: "bearer",
    });
    render(<AuthPanel mode="login" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "a@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(api.setToken).toHaveBeenCalledWith("token"));
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("keeps credentials visible when authentication fails", async () => {
    api.loginUser.mockRejectedValue(new Error("offline"));
    render(<AuthPanel mode="login" />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "a@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Login failed. Please try again.",
    );
    expect(screen.getByLabelText("Email")).toHaveValue("a@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("password123");
  });
});
