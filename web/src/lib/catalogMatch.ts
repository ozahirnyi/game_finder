type CatalogSearchResult = { id: number; name: string };

/** Narrows the catalog response only after its route-safe identity is present. */
export function hasCatalogId<T extends { id: number | null; name: string }>(
  game: T,
): game is T & CatalogSearchResult {
  return typeof game.id === "number";
}

export function exactCatalogMatch<T extends CatalogSearchResult>(
  results: T[],
  title: string,
): T | undefined {
  const normalizedTitle = title.trim().toLocaleLowerCase();
  return (
    results.find((game) => game.name.trim().toLocaleLowerCase() === normalizedTitle) ??
    results.find((game) => {
      const normalizedName = game.name.trim().toLocaleLowerCase();
      return [":", " -", " —"].some((separator) =>
        normalizedName.startsWith(`${normalizedTitle}${separator}`),
      );
    })
  );
}
