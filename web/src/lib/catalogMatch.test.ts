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

  it("accepts an official catalog subtitle but rejects similarly named games", () => {
    expect(
      exactCatalogMatch(
        [
          { id: 326292, name: "Fall Guys: Ultimate Knockout" },
          { id: 915700, name: "Fall Guys 2.0" },
          { id: 705384, name: "Fall Guys: Begger's Edition" },
        ],
        "Fall Guys",
      ),
    ).toMatchObject({ id: 326292 });
  });
});
