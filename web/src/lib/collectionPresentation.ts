export function librarySource(source: string) {
  const normalized = source.toLowerCase();
  if (normalized === "steam") return "Steam";
  if (normalized === "psn" || normalized === "playstation") return "PlayStation";
  return source;
}

export function libraryPlaytime(minutes: number | null | undefined) {
  return minutes == null ? "—" : `${Math.floor(minutes / 60)}h`;
}

export function wishlistPriceLabel(price?: { amount: number; currency: string } | null) {
  return price ? `${price.amount.toFixed(2)} ${price.currency}` : "Price unavailable";
}
