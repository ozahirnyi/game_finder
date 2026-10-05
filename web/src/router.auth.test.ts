// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { clearToken, setToken } from "./lib/api";
import { getRouter } from "./router";

describe("router query cache across account changes", () => {
  afterEach(() => clearToken());

  it("removes account A's cached friend requests before account B reads them", () => {
    clearToken();
    const client = getRouter().options.context.queryClient;
    setToken("account-a");
    client.setQueryData(["friend-requests", "incoming"], [{ id: "a-request" }]);

    clearToken();
    setToken("account-b");

    expect(client.getQueryData(["friend-requests", "incoming"])).toBeUndefined();
  });

  it("does not restore an in-flight A response after B has loaded", async () => {
    clearToken();
    const client = getRouter().options.context.queryClient;
    setToken("account-a");
    let resolveA!: (value: string[]) => void;
    const aResponse = new Promise<string[]>((resolve) => {
      resolveA = resolve;
    });
    const pendingA = client
      .fetchQuery({
        queryKey: ["friend-requests", "incoming"],
        queryFn: () => aResponse,
      })
      .catch(() => []);

    clearToken();
    setToken("account-b");
    await client.fetchQuery({
      queryKey: ["friend-requests", "incoming"],
      queryFn: async () => ["b-request"],
    });
    resolveA(["a-request"]);
    await pendingA;

    expect(client.getQueryData(["friend-requests", "incoming"])).toEqual(["b-request"]);
  });
});
