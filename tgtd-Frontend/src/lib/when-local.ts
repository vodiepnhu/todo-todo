const SYDNEY_TZ = "Australia/Sydney";

export type WhenParts = {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
};

/** Split an ISO timestamptz into Sydney calendar date + clock time. */
export function isoToWhenParts(
  iso: string | null | undefined,
  timeZone = SYDNEY_TZ,
): WhenParts | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);

  return { date, time };
}

/**
 * Combine Sydney local date+time into an ISO UTC string.
 * Uses a midday probe to resolve the correct offset (DST-safe enough for AU).
 */
export function whenPartsToIso(
  parts: WhenParts,
  timeZone = SYDNEY_TZ,
): string | null {
  if (!parts.date || !/^\d{4}-\d{2}-\d{2}$/.test(parts.date)) return null;
  const time = parts.time && /^\d{2}:\d{2}$/.test(parts.time) ? parts.time : "09:00";

  const probe = new Date(`${parts.date}T12:00:00Z`);
  const offsetFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  });
  const offsetPart =
    offsetFmt.formatToParts(probe).find((p) => p.type === "timeZoneName")
      ?.value ?? "GMT+10";
  // GMT+10 / GMT+11 / GMT+9:30 → +10:00 / +11:00 / +09:30
  const m = offsetPart.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return null;
  const sign = m[1] === "-" ? "-" : "+";
  const hh = m[2].padStart(2, "0");
  const mm = (m[3] ?? "00").padStart(2, "0");
  const local = `${parts.date}T${time}:00${sign}${hh}:${mm}`;
  const parsed = new Date(local);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function formatWhenLabel(
  iso: string | null | undefined,
  timeZone = SYDNEY_TZ,
): string {
  if (!iso) return "Not set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function mergeWhenParts(
  current: WhenParts | null,
  patch: Partial<WhenParts>,
): WhenParts {
  return {
    date: patch.date ?? current?.date ?? "",
    time: patch.time ?? current?.time ?? "09:00",
  };
}
