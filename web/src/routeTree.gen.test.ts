import { describe, expect, it } from "vitest";

import { routeTree } from "./routeTree.gen";

describe("route tree", () => {
  it("registers the canonical anonymous public-profile route", () => {
    expect(Object.values(routeTree.children ?? {}).map((child) => child.options.id)).toContain(
      "/users/$publicId",
    );
  });
});
