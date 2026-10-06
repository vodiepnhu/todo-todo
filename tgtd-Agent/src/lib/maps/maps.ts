const TRUSTED_MAP_HOSTS = [
  "maps.app.goo.gl",
  "goo.gl",
  "www.google.com",
  "google.com",
  "maps.google.com",
];

export function extractGoogleMapsUrl(text: string): string | null {
  const urlMatch = text.match(
    /https?:\/\/[^\s]+/gi,
  );
  if (!urlMatch) return null;
  for (const raw of urlMatch) {
    try {
      const u = new URL(raw.replace(/[),.;]+$/, ""));
      if (
        TRUSTED_MAP_HOSTS.some(
          (h) => u.hostname === h || u.hostname.endsWith(".google.com"),
        ) &&
        (u.hostname.includes("maps") ||
          u.pathname.includes("/maps") ||
          u.hostname.includes("goo.gl"))
      ) {
        return u.toString();
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function safeMapsRedirect(url: string): string | null {
  try {
    const u = new URL(url);
    const ok = TRUSTED_MAP_HOSTS.some(
      (h) => u.hostname === h || u.hostname.endsWith(".google.com"),
    );
    return ok ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function searchPlace(query: string) {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) {
    return { degraded: true as const, results: [] as never[] };
  }
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`,
  );
  if (!res.ok) return { degraded: true as const, results: [] as never[] };
  const json = await res.json();
  return {
    degraded: false as const,
    results: (json.results ?? []).slice(0, 5).map(
      (r: {
        place_id: string;
        name: string;
        formatted_address: string;
        geometry?: { location?: { lat: number; lng: number } };
      }) => ({
        googlePlaceId: r.place_id,
        name: r.name,
        formattedAddress: r.formatted_address,
        latitude: r.geometry?.location?.lat ?? null,
        longitude: r.geometry?.location?.lng ?? null,
      }),
    ),
  };
}

export async function getRouteEta(opts: {
  origin: string;
  destination: string;
  mode?: string;
}) {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) {
    return { degraded: true as const, distance: null, duration: null };
  }
  const mode = opts.mode ?? "driving";
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(opts.origin)}&destination=${encodeURIComponent(opts.destination)}&mode=${mode}&key=${key}`,
  );
  if (!res.ok) return { degraded: true as const, distance: null, duration: null };
  const json = await res.json();
  const leg = json.routes?.[0]?.legs?.[0];
  return {
    degraded: false as const,
    distance: leg?.distance?.text ?? null,
    duration: leg?.duration?.text ?? null,
    durationSeconds: leg?.duration?.value ?? null,
  };
}
