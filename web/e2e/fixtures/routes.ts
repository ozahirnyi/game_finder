import type { Page, Route } from "@playwright/test";
import { createGuestHomeFixtures } from "./api-fixtures";

export type ApiRequest = {
  method: string;
  path: string;
  query: string;
  jsonBody?: unknown;
};

export type ApiRoutes = { requests: ApiRequest[] };

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
    requests.push(requestRecord);

    const fixtures = createGuestHomeFixtures();
    if (request.method() === "GET" && path === "/catalog/trending-games") {
      await route.fulfill({ json: fixtures.trendingGames });
      return;
    }
    if (request.method() === "GET" && path === "/search/games") {
      await route.fulfill({ json: fixtures.searchGames });
      return;
    }
    if (request.method() === "GET" && path === "/prices/deals") {
      await route.fulfill({ json: fixtures.deals });
      return;
    }

    await route.fulfill({ status: 501, json: { detail: "Unmocked API request" } });
  });

  return { requests };
}
