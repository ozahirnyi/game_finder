import { describe, expect, it } from "vitest";

import { exactCatalogMatch } from "./catalogMatch";

describe("exactCatalogMatch", () => {
  it("returns only the catalog game whose title exactly matches", () => {
    expect(
      exactCatalogMatch(
        [
          { id: 635275, name: "Company of Heroes 3 - Pre-Alpha Preview" },
          { id: 123, name: "Company of Heroes 3: Final Stand" },
        ],
        "Company of Heroes 3: Final Stand",
      ),
    ).toMatchObject({ id: 123 });
  });
});
