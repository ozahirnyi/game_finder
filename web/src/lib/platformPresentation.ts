export function summarizePlatforms(platforms: string[], limit = 3) {
  const visible = platforms.slice(0, limit);
  return { visible, remainingCount: Math.max(platforms.length - visible.length, 0) };
}
