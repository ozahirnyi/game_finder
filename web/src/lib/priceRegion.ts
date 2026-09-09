export const PRICE_COUNTRIES = [
  ["US", "United States"],
  ["UA", "Ukraine"],
  ["GB", "United Kingdom"],
  ["DE", "Germany"],
  ["PL", "Poland"],
  ["TR", "Türkiye"],
  ["AR", "Argentina"],
  ["KZ", "Kazakhstan"],
] as const;

export type PriceCountryCode = (typeof PRICE_COUNTRIES)[number][0];

export function normalizePriceCountry(value?: string | null): PriceCountryCode {
  return PRICE_COUNTRIES.some(([code]) => code === value) ? (value as PriceCountryCode) : "US";
}
