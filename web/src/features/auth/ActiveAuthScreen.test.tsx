import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, loginUser, setToken } from "@/lib/api";
import { ActiveAuthScreen } from "./ActiveAuthScreen";

const api = vi.hoisted(() => ({
  ApiError: class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
  loginUser: vi.fn(),
  setToken: vi.fn(),
}));

vi.mock("@/lib/api", () => api);

describe("ActiveAuthScreen", () => {
  const onSuccess = vi.fn();

  beforeEach(() => {
    onSuccess.mockReset();
    vi.mocked(loginUser).mockReset();
    vi.mocked(setToken).mockReset();
  });

  it("stores the token and navigates after sign in", async () => {
    vi.mocked(loginUser).mockResolvedValue({ access_token: "token", token_type: "bearer" });
    render(<ActiveAuthScreen onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "player@example.test" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(setToken).toHaveBeenCalledWith("token"));
    expect(onSuccess).toHaveBeenCalled();
  });

  it("prevents duplicate submits while login is pending", async () => {
    vi.mocked(loginUser).mockReturnValue(new Promise(() => undefined));
    render(<ActiveAuthScreen onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "player@example.test" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } });
    const submit = screen.getByRole("button", { name: /sign in/i });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(await screen.findByRole("button", { name: /signing in/i })).toBeDisabled();
    expect(loginUser).toHaveBeenCalledTimes(1);
  });

  it("shows the API error without navigating", async () => {
    vi.mocked(loginUser).mockRejectedValue(new ApiError("Invalid email or password", 401));
    render(<ActiveAuthScreen onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "player@example.test" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
