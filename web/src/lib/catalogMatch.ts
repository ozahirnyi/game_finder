type CatalogSearchResult = { id: number; name: string };

export function exactCatalogMatch<T extends CatalogSearchResult>(results: T[], title: string): T | undefined {
  return results.find((game) => game.name.trim().toLocaleLowerCase() === title.trim().toLocaleLowerCase());
}
