import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearToken, getToken, setToken } from "./api";
import {
  completeLogin,
  currentUserQueryOptions,
  signOut,
} from "./auth-session";

afterEach(() => clearToken());

describe("auth session", () => {
  it("enables the current-user query only with a token", () => {
    clearToken();
    expect(currentUserQueryOptions().enabled).toBe(false);

    setToken("header.eyJleHAiOjQxMDI0NDQ4MDB9.signature");

    expect(currentUserQueryOptions().enabled).toBe(true);
    expect(currentUserQueryOptions().queryKey).toEqual(["auth", "me"]);
    expect(currentUserQueryOptions().meta).toMatchObject({ auth: true });
  });

  it("stores a login token and invalidates the current-user query", async () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    completeLogin("header.eyJleHAiOjQxMDI0NDQ4MDB9.signature", queryClient);

    expect(getToken()).not.toBeNull();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["auth", "me"],
    });
  });

  it("clears the token and authenticated query data on logout", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["auth", "me"], { email: "user@example.test" });
    queryClient.setQueryData(["catalog", "search", "Hades"], { results: [] });
    setToken("header.eyJleHAiOjQxMDI0NDQ4MDB9.signature");

    signOut(queryClient);

    expect(getToken()).toBeNull();
    expect(queryClient.getQueryData(["auth", "me"])).toBeUndefined();
    expect(queryClient.getQueryData(["catalog", "search", "Hades"])).toEqual({
      results: [],
    });
  });
});
