import { describe, expect, it } from "vitest";
import { friendDisplayName } from "./friendIdentity";

describe("friendDisplayName", () => {
  it("prefers a non-empty Steam persona name", () => {
    expect(
      friendDisplayName({ display_name: "Playfinder", steam_persona_name: "  Steam Persona  " }),
    ).toBe("Steam Persona");
  });

  it("falls back to the Playfinder name", () => {
    expect(friendDisplayName({ display_name: "Playfinder", steam_persona_name: "   " })).toBe(
      "Playfinder",
    );
  });
});
