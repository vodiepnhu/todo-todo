export const PROJECT_ICON_PRESETS = [
  "✈️",
  "🏠",
  "💼",
  "🗺️",
  "🎯",
  "📚",
  "🧪",
  "✨",
  "🚀",
  "💡",
  "🎨",
  "🏃",
  "🍜",
  "🎵",
  "📦",
  "🌱",
  "🔧",
  "📝",
  "🎓",
  "❤️",
  "⭐",
  "🔥",
  "🌊",
  "🏔️",
] as const;

export const PROJECT_COLOR_PRESETS = [
  "#0f766e",
  "#0ea5e9",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f59e0b",
  "#10b981",
  "#6366f1",
  "#64748b",
  "#1e293b",
] as const;

/** Normalize to lowercase `#rrggbb`, or null if empty/invalid. Expands `#rgb`. */
export function normalizeHex(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-f]{6}$/.test(withHash)) return withHash;
  if (/^#[0-9a-f]{3}$/.test(withHash)) {
    const r = withHash[1];
    const g = withHash[2];
    const b = withHash[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

export function isValidHex(input: string | null | undefined): boolean {
  return normalizeHex(input) !== null;
}
