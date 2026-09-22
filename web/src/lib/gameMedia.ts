export type MediaKind = "cover" | "wide" | "unknown";

export type MediaCandidate = {
  src: string;
  kind: MediaKind;
  srcSet?: string;
  width?: number;
  height?: number;
};

export type GameMediaInput = {
  coverUrl?: string | null;
  heroUrl?: string | null;
  screenshotUrl?: string | null;
  steamAppId?: number | null;
  coverWidth?: number | null;
  coverHeight?: number | null;
  heroWidth?: number | null;
  heroHeight?: number | null;
  screenshotWidth?: number | null;
  screenshotHeight?: number | null;
};

const IGDB_HOST = "images.igdb.com";

function validUrl(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isIgdbUrl(value: string) {
  try {
    return new URL(value).hostname === IGDB_HOST;
  } catch {
    return false;
  }
}

function replaceIgdbSize(value: string, size: string) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/t_[^/]+(?=\/)/, size);
  return url.toString();
}

function candidate(
  value: string,
  kind: MediaKind,
  width?: number | null,
  height?: number | null,
): MediaCandidate {
  const resolved: MediaCandidate = { src: value, kind };
  if (typeof width === "number" && width > 0) resolved.width = width;
  if (typeof height === "number" && height > 0) resolved.height = height;
  if (kind === "cover" && isIgdbUrl(value)) {
    const standard = replaceIgdbSize(value, "t_cover_big");
    resolved.src = standard;
    resolved.srcSet = `${standard} 264w, ${replaceIgdbSize(value, "t_cover_big_2x")} 528w`;
  }
  if (kind === "cover") {
    try {
      const url = new URL(value);
      if (
        url.protocol === "https:" &&
        url.hostname === "cdn.cloudflare.steamstatic.com" &&
        /^\/steam\/apps\/[1-9]\d*\/library_600x900\.jpg$/.test(url.pathname)
      ) {
        // Steam's base library asset is 300x450 despite its filename.
        url.pathname = url.pathname.replace(/library_600x900\.jpg$/, "library_600x900_2x.jpg");
        resolved.srcSet = `${value} 300w, ${url.toString()} 600w`;
      }
    } catch {
      // Relative or unknown provider URLs keep their original behavior.
    }
  }
  return resolved;
}

function isWide(width?: number | null, height?: number | null) {
  return (
    typeof width === "number" &&
    typeof height === "number" &&
    width >= 1280 &&
    height > 0 &&
    width / height >= 1.5
  );
}

function unique(candidates: MediaCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((item) => !seen.has(item.src) && Boolean(seen.add(item.src)));
}

function steamAsset(appid: number, asset: "library_600x900.jpg" | "library_hero.jpg") {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/${asset}`;
}

/** Builds deterministic display candidates only; image availability is handled by GameCover. */
export function getGameMediaCandidates(
  input: GameMediaInput,
  role: "poster" | "banner",
): MediaCandidate[] {
  const cover = validUrl(input.coverUrl);
  const hero = validUrl(input.heroUrl);
  const screenshot = validUrl(input.screenshotUrl);
  const appid =
    typeof input.steamAppId === "number" &&
    Number.isInteger(input.steamAppId) &&
    input.steamAppId > 0
      ? input.steamAppId
      : undefined;

  if (role === "poster") {
    return unique([
      ...(cover ? [candidate(cover, "cover", input.coverWidth, input.coverHeight)] : []),
      ...(appid ? [candidate(steamAsset(appid, "library_600x900.jpg"), "cover")] : []),
      ...(hero ? [candidate(hero, "unknown", input.heroWidth, input.heroHeight)] : []),
      ...(screenshot
        ? [candidate(screenshot, "unknown", input.screenshotWidth, input.screenshotHeight)]
        : []),
    ]);
  }

  return unique([
    ...(hero && isWide(input.heroWidth, input.heroHeight)
      ? [candidate(hero, "wide", input.heroWidth, input.heroHeight)]
      : []),
    ...(appid ? [candidate(steamAsset(appid, "library_hero.jpg"), "wide")] : []),
    ...(screenshot && isWide(input.screenshotWidth, input.screenshotHeight)
      ? [candidate(screenshot, "wide", input.screenshotWidth, input.screenshotHeight)]
      : []),
    ...(cover ? [candidate(cover, "cover", input.coverWidth, input.coverHeight)] : []),
    ...(appid ? [candidate(steamAsset(appid, "library_600x900.jpg"), "cover")] : []),
  ]);
}
