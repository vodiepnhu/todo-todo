export type ActivityIconName =
  | "bike"
  | "book-open"
  | "camera"
  | "car"
  | "coffee"
  | "dumbbell"
  | "footprints"
  | "landmark"
  | "music"
  | "shopping-bag"
  | "sparkles"
  | "tree-pine"
  | "utensils"
  | "waves";

const ICON_GLYPHS: Record<ActivityIconName, string> = {
  bike: "🚲",
  "book-open": "📖",
  camera: "📸",
  car: "🚗",
  coffee: "☕",
  dumbbell: "🏋️",
  footprints: "🥾",
  landmark: "🏛️",
  music: "🎵",
  "shopping-bag": "🛍️",
  sparkles: "✨",
  "tree-pine": "🌲",
  utensils: "🍜",
  waves: "🌊",
};

const ACTIVITY_RULES: Array<[RegExp, ActivityIconName]> = [
  [
    /\b(?:swim|swimming|beach|ocean|sea|surf|boi|bien|luot song)\b/,
    "waves",
  ],
  [
    /\b(?:photo|photos|photography|camera|check[ -]?in|chup anh)\b/,
    "camera",
  ],
  [
    /\b(?:coffee|cafe|brunch|bakery|ca phe)\b/,
    "coffee",
  ],
  [
    /\b(?:food|dinner|lunch|breakfast|restaurant|eat|an|nha hang|bua)\b/,
    "utensils",
  ],
  [
    /\b(?:museum|gallery|landmark|bao tang|trien lam)\b/,
    "landmark",
  ],
  [
    /\b(?:shopping|shop|mall|groceries|mua sam|mua do|sieu thi)\b/,
    "shopping-bag",
  ],
  [
    /\b(?:walk|hike|hiking|trail|trek|di bo|leo nui|duong mon)\b/,
    "footprints",
  ],
  [
    /\b(?:nature|park|garden|picnic|cong vien|thien nhien|vuon)\b/,
    "tree-pine",
  ],
  [
    /\b(?:gym|fitness|yoga|run|running|workout|tap luyen|chay bo)\b/,
    "dumbbell",
  ],
  [
    /\b(?:music|concert|karaoke|nhac|hoa nhac)\b/,
    "music",
  ],
  [
    /\b(?:bike|bicycle|cycling|dap xe|xe dap)\b/,
    "bike",
  ],
  [
    /\b(?:drive|driving|road trip|car|parking|lai xe|o to|do xe)\b/,
    "car",
  ],
  [
    /\b(?:book|reading|library|sach|doc sach|thu vien)\b/,
    "book-open",
  ],
];

export function getActivityIconName(text: string): ActivityIconName {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  return (
    ACTIVITY_RULES.find(([pattern]) => pattern.test(normalized))?.[1] ??
    "sparkles"
  );
}

export function getActivityIconGlyph(text: string): string {
  return ICON_GLYPHS[getActivityIconName(text)];
}

export function ActivityIcon({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center text-lg leading-none ${className ?? ""}`}
      aria-hidden="true"
    >
      {getActivityIconGlyph(text)}
    </span>
  );
}
