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

    const delay = state.delays[path];
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const configuredStatus = state.statusByPath[path];
    if (configuredStatus) {
      await route.fulfill({ status: configuredStatus, json: { detail: "Fixture response" } });
      return;
    }

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
    if (request.method() === "GET" && path === "/catalog/games/101") {
      await route.fulfill({
        json: {
          id: 101,
          name: "Celeste",
          genres: ["Platformer"],
          platforms: ["PC"],
          description_raw: "A mountain adventure.",
        },
      });
      return;
    }
    if (request.method() === "GET" && path === "/steam/games/440") {
      await route.fulfill({
        json: {
          appid: 440,
          name: "Team Fortress 2",
          genres: [],
          platforms: ["PC"],
          description_raw: "Steam game.",
        },
      });
      return;
    }
    if (
      request.method() === "GET" &&
      (path === "/prices/games/101" || path === "/prices/steam-games/440")
    ) {
      await route.fulfill({ json: { history: [] } });
      return;
    }
    if (request.method() === "POST" && path === "/auth/login") {
      await route.fulfill({ json: { access_token: "browser-token", token_type: "bearer" } });
      return;
    }
    if (request.method() === "GET" && path === "/profile") {
      await route.fulfill({ json: state.profile });
      return;
    }
    if (request.method() === "GET" && path === "/library/overview") {
      await route.fulfill({ json: state.library });
      return;
    }
    if (request.method() === "GET" && path === "/favorites") {
      await route.fulfill({ json: [] });
      return;
    }
    if (request.method() === "POST" && path === "/favorites/catalog-games/101") {
      await route.fulfill({
        json: {
          id: "favorite-101",
          catalog_game_id: 101,
          source: "catalog",
          external_id: "101",
          title: "Celeste",
        },
      });
      return;
    }
    if (request.method() === "GET" && path === "/onboarding/summary") {
      if (state.onboardingFailureCount-- > 0) {
        await route.fulfill({ status: 500, json: { detail: "Unavailable" } });
        return;
      }
      await route.fulfill({ json: state.onboarding });
      return;
    }
    if (request.method() === "GET" && path === "/wishlist") {
      await route.fulfill({ json: state.wishlist });
      return;
    }
    if (request.method() === "POST" && path === "/wishlist/steam-games/440") {
      await route.fulfill({
        json: {
          id: "wishlist-440",
          catalog_game_id: 440,
          source: "steam",
          external_id: "440",
          title: "Team Fortress 2",
        },
      });
      return;
    }
    if (request.method() === "GET" && path === "/telegram/me") {
      await route.fulfill({ json: { configured: false, linked: false } });
      return;
    }
    if (request.method() === "GET" && path === "/price-alerts") {
      await route.fulfill({ json: state.alerts });
      return;
    }
    if (request.method() === "POST" && path === "/price-alerts") {
      const body = requestRecord.jsonBody as Omit<
        import("../../src/lib/api").PriceAlert,
        "id" | "created_at" | "updated_at"
      >;
      const alert = {
        ...body,
        id: "alert-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };
      state.alerts.push(alert);
      await route.fulfill({ json: alert });
      return;
    }
    if (request.method() === "GET" && path === "/friends") {
      await route.fulfill({ json: state.friends });
      return;
    }
    if (request.method() === "GET" && path === "/friends/requests/incoming") {
      await route.fulfill({ json: state.incomingFriendRequests });
      return;
    }
    if (request.method() === "GET" && path === "/steam/social") {
      await route.fulfill({ json: { friends: [], friends_total: 0, friends_has_more: false } });
      return;
    }
    if (request.method() === "GET" && path === "/users/search") {
      await route.fulfill({ json: state.users });
      return;
    }
    if (request.method() === "POST" && path === "/friends/requests") {
      await route.fulfill({ json: { id: "request-created", ...requestRecord.jsonBody } });
      return;
    }
    if (request.method() === "POST" && path === "/social/friend-requests") {
      await route.fulfill({ json: { id: "request-created", ...requestRecord.jsonBody } });
      return;
    }
    if (request.method() === "POST" && /^\/friends\/requests\/[^/]+\/accept$/.test(path)) {
      await route.fulfill({ json: state.friends[0] ?? { user: state.users[0] } });
      return;
    }
    if (request.method() === "GET" && path === "/conversations") {
      await route.fulfill({ json: state.conversations });
      return;
    }
    if (request.method() === "POST" && path === "/conversations") {
      const friendId = (requestRecord.jsonBody as { recipient_id: string }).recipient_id;
      const participant =
        state.friends.find((friend) => friend.user.id === friendId)?.user ?? state.users[0];
      const conversation = {
        id: "conversation-created",
        participant,
        updated_at: "2026-08-21T00:00:00Z",
      };
      state.conversations.push(conversation);
      await route.fulfill({ json: conversation });
      return;
    }
    const conversationMessages = path.match(/^\/conversations\/([^/]+)\/messages$/);
    if (conversationMessages && request.method() === "GET") {
      await route.fulfill({ json: state.messages[conversationMessages[1]] ?? [] });
      return;
    }
    if (conversationMessages && request.method() === "POST") {
      const message = {
        id: "message-created",
        sender_id: "user-1",
        body: (requestRecord.jsonBody as { body: string }).body,
        created_at: "2026-08-21T00:00:00Z",
      };
      state.messages[conversationMessages[1]] = [
        ...(state.messages[conversationMessages[1]] ?? []),
        message,
      ];
      await route.fulfill({ json: message });
      return;
    }
    if (request.method() === "GET" && path === "/game-invites") {
      await route.fulfill({ json: state.gameInvites });
      return;
    }
    if (request.method() === "POST" && path === "/game-invites") {
      const recipientId = (requestRecord.jsonBody as { recipient_id: string }).recipient_id;
      const recipient =
        state.friends.find((friend) => friend.user.id === recipientId)?.user ?? state.users[0];
      const sender = {
        id: state.profile.id,
        public_id: "player",
        display_name: state.profile.display_name,
      };
      const invite = {
        id: "invite-created",
        ...(requestRecord.jsonBody as object),
        status: "pending",
        sender,
        recipient,
        created_at: "2026-08-21T00:00:00Z",
      };
      state.gameInvites.push(invite as GameInvite);
      await route.fulfill({ json: invite });
      return;
    }
    if (request.method() === "POST" && /^\/game-invites\/[^/]+\/response$/.test(path)) {
      const id = path.split("/")[2];
      const invite = state.gameInvites.find((item) => item.id === id);
      const response = {
        ...invite,
        status: (requestRecord.jsonBody as { status: "accepted" | "declined" }).status,
      };
      await route.fulfill({ json: response });
      return;
    }
    if (request.method() === "GET" && path === "/notifications") {
      await route.fulfill({ json: state.notifications });
      return;
    }
    if (request.method() === "POST" && /^\/notifications\/[^/]+\/read$/.test(path)) {
      const id = path.split("/")[2];
      const notification = state.notifications.find((item) => item.id === id);
      if (notification) notification.read_at = "2026-08-21T00:00:00Z";
      await route.fulfill({ json: notification ?? {} });
      return;
    }
    if (request.method() === "POST" && path === "/notifications/read-all") {
      state.notifications.forEach((notification) => {
        notification.read_at = "2026-08-21T00:00:00Z";
      });
      await route.fulfill({ json: {} });
      return;
    }
    const publicProfile = path.match(/^\/users\/([^/]+)$/);
    if (publicProfile && request.method() === "GET") {
      const profile = state.publicProfiles[decodeURIComponent(publicProfile[1])];
      if (!profile) {
        await route.fulfill({ status: 404, json: { detail: "Not found" } });
        return;
      }
      await route.fulfill({ json: profile });
      return;
    }
    const friendProfile = path.match(/^\/users\/([^/]+)\/friend-profile$/);
    if (friendProfile && request.method() === "GET") {
      const profile = state.friendProfiles[decodeURIComponent(friendProfile[1])];
      if (!profile) {
        await route.fulfill({ status: 404, json: { detail: "Not found" } });
        return;
      }
      await route.fulfill({ json: profile });
      return;
    }
    const sharedLibrary = path.match(/^\/friends\/([^/]+)\/shared-games$/);
    if (sharedLibrary && request.method() === "GET") {
      await route.fulfill({
        json: state.sharedLibraries[sharedLibrary[1]] ?? { status: "empty", data: [] },
      });
      return;
    }

    await route.fulfill({ status: 501, json: { detail: "Unmocked API request" } });
  });

  return { requests, state };
}
