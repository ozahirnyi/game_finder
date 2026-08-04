type CatalogSearchResult = { id: number; name: string };

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
