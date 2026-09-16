import { describe, expect, it } from "vitest";
import { Route } from "./__root";

describe("root document head", () => {
  it("declares the Playfinder favicon assets", () => {
    const head = Route.options.head?.();

    expect(head?.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rel: "icon", href: "/favicon-32.png", sizes: "32x32" }),
        expect.objectContaining({ rel: "icon", href: "/favicon-16.png", sizes: "16x16" }),
        expect.objectContaining({ rel: "apple-touch-icon", href: "/apple-touch-icon.png" }),
      ]),
    );
  });
});
