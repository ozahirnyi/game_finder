export function librarySource(source: string) {
  const normalized = source.toLowerCase();
  if (normalized === "steam") return "Steam";
  if (normalized === "psn" || normalized === "playstation") return "PlayStation";
  return source;
}

export function libraryPlaytime(minutes: number | null | undefined) {
  return minutes == null ? "—" : `${(minutes / 60).toFixed(1)}h`;
}

export function wishlistPriceLabel() {
  return "Price unavailable";
}
