import type { Page, Route } from "@playwright/test";
import { createGuestHomeFixtures, type ApiState } from "./api-fixtures";

export type ApiRequest = {
  method: string;
  path: string;
  query: string;
  jsonBody?: unknown;
  formBody?: string;
};

export type ApiRoutes = { requests: ApiRequest[]; state: ApiState };

async function jsonBody(route: Route) {
  if (route.request().postData() === null) return undefined;
  try {
    return route.request().postDataJSON();
  } catch {
    return undefined;
  }
}

export async function installGuestHomeRoutes(page: Page): Promise<ApiRoutes> {
  const requests: ApiRequest[] = [];
  const state = createGuestHomeFixtures();

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, "") || "/";
    const requestRecord: ApiRequest = {
      method: request.method(),
      path,
      query: url.searchParams.toString(),
    };
    const body = await jsonBody(route);
    if (body !== undefined) requestRecord.jsonBody = body;
    if (request.postData()) requestRecord.formBody = request.postData();
    requests.push(requestRecord);

    if (request.method() === "GET" && path === "/catalog/trending-games") {
      if (state.trendingFailureCount > 0) {
        state.trendingFailureCount -= 1;
        await route.fulfill({ status: 500, json: { detail: "Catalog unavailable" } });
        return;
      }
      await route.fulfill({ json: state.trendingGames });
      return;
    }
    if (request.method() === "GET" && path === "/search/games") {
      await route.fulfill({ json: state.searchGames });
      return;
    }
    if (request.method() === "GET" && path === "/prices/deals") {
      await route.fulfill({ json: state.deals });
      return;
    }
    if (request.method() === "POST" && path === "/auth/login") {
      await route.fulfill({ json: { access_token: "browser-token", token_type: "bearer" } });
      return;
    }

    await route.fulfill({ status: 501, json: { detail: "Unmocked API request" } });
  });

  return { requests, state };
}
