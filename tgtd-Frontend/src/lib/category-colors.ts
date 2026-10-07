export type CategoryPalette = {
  card: string;
  icon: string;
  count: string;
  badge: string;
};

const PALETTES: Record<string, CategoryPalette> = {
  food: {
    card: "border-orange-200/80 bg-orange-50/75",
    icon: "bg-orange-100 text-orange-700",
    count: "text-orange-700",
    badge: "border-orange-200 bg-orange-50 text-orange-800",
  },
  nature: {
    card: "border-emerald-200/80 bg-emerald-50/75",
    icon: "bg-emerald-100 text-emerald-700",
    count: "text-emerald-700",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  culture: {
    card: "border-violet-200/80 bg-violet-50/75",
    icon: "bg-violet-100 text-violet-700",
    count: "text-violet-700",
    badge: "border-violet-200 bg-violet-50 text-violet-800",
  },
  wellness: {
    card: "border-rose-200/80 bg-rose-50/75",
    icon: "bg-rose-100 text-rose-700",
    count: "text-rose-700",
    badge: "border-rose-200 bg-rose-50 text-rose-800",
  },
  travel: {
    card: "border-sky-200/80 bg-sky-50/75",
    icon: "bg-sky-100 text-sky-700",
    count: "text-sky-700",
    badge: "border-sky-200 bg-sky-50 text-sky-800",
  },
  default: {
    card: "border-slate-200/80 bg-slate-50/75",
    icon: "bg-slate-100 text-slate-700",
    count: "text-slate-700",
    badge: "border-slate-200 bg-slate-50 text-slate-800",
  },
};

export function categoryPalette(category: string): CategoryPalette {
  const value = category.toLowerCase();
  if (/food|restaurant|lunch|dinner|cafe|coffee|meal|ăn|uống/.test(value)) {
    return PALETTES.food;
  }
  if (/nature|park|garden|beach|walk|hike|outdoor|biển|dạo/.test(value)) {
    return PALETTES.nature;
  }
  if (/culture|museum|landmark|art|music|văn hoá|bảo tàng/.test(value)) {
    return PALETTES.culture;
  }
  if (/wellness|health|gym|fitness|yoga|sức khoẻ|thể thao/.test(value)) {
    return PALETTES.wellness;
  }
  if (/travel|transport|drive|car|flight|di chuyển/.test(value)) {
    return PALETTES.travel;
  }
  return PALETTES.default;
}
