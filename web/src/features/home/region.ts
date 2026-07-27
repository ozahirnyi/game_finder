export const FALLBACK_REGION = "US" as const;

export function countryFromLanguage(language: string | undefined): string {
  const match = language?.match(/[-_]([a-z]{2})$/i);
  return match ? match[1].toUpperCase() : FALLBACK_REGION;
}

export function initialCountry(): string {
  return typeof navigator === "undefined"
    ? FALLBACK_REGION
    : countryFromLanguage(navigator.language);
}

export function shouldFallbackToUsd(country: string): boolean {
  return country.toUpperCase() !== FALLBACK_REGION;
}
