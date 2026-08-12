export function normalizePlatforms(platforms: string[]) {
  return platforms.reduce<string[]>((summary, platform) => {
    const label = ["windows", "macos", "mac", "linux", "pc (microsoft windows)"].includes(
      platform.toLowerCase(),
    )
      ? "PC"
      : platform;
    return summary.includes(label) ? summary : [...summary, label];
  }, []);
}

export function summarizePlatforms(platforms: string[], limit = 3) {
  const normalized = normalizePlatforms(platforms);
  const visible = normalized.slice(0, limit);
  return { visible, remainingCount: Math.max(normalized.length - visible.length, 0) };
}
