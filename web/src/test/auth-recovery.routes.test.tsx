import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "../routes/login";
import { RegisterPage } from "../routes/register";
import { ProfilePage } from "../routes/profile";

const api = vi.hoisted(() => ({
  ApiError: class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  getCurrentUser: vi.fn(),
  getGoogleLinkUrl: vi.fn(),
  getGoogleStatus: vi.fn(),
  getTelegramAccount: vi.fn(),
  getTelegramLinkUrl: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  sendTelegramTestAlert: vi.fn(),
  setToken: vi.fn(),
  unlinkTelegramAccount: vi.fn(),
}));

const navigate = vi.fn();

vi.mock("@/lib/api", () => api);
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({}),
  Link: ({ children, to, ...props }: React.ComponentProps<"a"> & { to: string }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => navigate,
}));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/GameCover", () => ({ Avatar: () => null, GameCover: () => null }));
vi.mock("@/components/ui-bits", () => ({ Chip: ({ children }: { children: React.ReactNode }) => <span>{children}</span>, SectionHeader: ({ title }: { title: string }) => <h2>{title}</h2> }));

describe("auth recovery routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs in, stores the token, and opens the profile", async () => {
    api.loginUser.mockResolvedValue({ access_token: "token", token_type: "bearer" });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(api.setToken).toHaveBeenCalledWith("token"));
    expect(navigate).toHaveBeenCalledWith({ to: "/profile" });
  });

  it("registers before logging in and opens the profile", async () => {
    api.registerUser.mockResolvedValue({ id: "user-id", email: "a@example.com" });
    api.loginUser.mockResolvedValue({ access_token: "token", token_type: "bearer" });
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(api.setToken).toHaveBeenCalledWith("token"));
    expect(api.registerUser).toHaveBeenCalledWith("a@example.com", "password123");
    expect(api.loginUser).toHaveBeenCalledWith("a@example.com", "password123");
    expect(navigate).toHaveBeenCalledWith({ to: "/profile" });
  });

  it("keeps the credentials and shows the error when login fails", async () => {
    api.loginUser.mockRejectedValue(new Error("offline"));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Login failed. Please try again.");
    expect(screen.getByLabelText("Email")).toHaveValue("a@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("password123");
  });

  it("uses Vite Lovable utility classes instead of legacy auth classes", () => {
    const { container } = render(<LoginPage />);
    const section = container.querySelector("section");
    const form = container.querySelector("form");

    expect(section).toHaveClass("min-h-screen", "bg-background");
    expect(section).not.toHaveClass("auth-page");
    expect(form).toHaveClass("space-y-4");
    expect(form).not.toHaveClass("form-stack");
  });

  it("offers a sign-in link when the profile request is unauthorized", async () => {
    api.getCurrentUser.mockRejectedValue(new api.ApiError("Your session expired. Please log in again.", 401));
    render(<ProfilePage />);

    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });
});
