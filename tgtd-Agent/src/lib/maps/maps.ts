export function googleMapsPlaceUrl(input: {
  name: string;
  formattedAddress?: string | null;
  googlePlaceId?: string | null;
}): string {
  const query = encodeURIComponent(input.name || input.formattedAddress || "");
  const placeId = input.googlePlaceId
    ? `&query_place_id=${encodeURIComponent(input.googlePlaceId)}`
    : "";
  return `https://www.google.com/maps/search/?api=1&query=${query}${placeId}`;
}

function isTrustedMapsUrl(u: URL) {
  if (u.protocol !== "https:" || u.username || u.password) return false;
  if (u.hostname === "maps.app.goo.gl") return true;
  if (u.hostname === "goo.gl") return u.pathname.startsWith("/maps");
  return (
    (u.hostname === "google.com" || u.hostname === "www.google.com") &&
    u.pathname.startsWith("/maps")
  ) || u.hostname === "maps.google.com";
}

export function extractGoogleMapsUrl(text: string): string | null {
  const urlMatch = text.match(
    /https?:\/\/[^\s]+/gi,
  );
  if (!urlMatch) return null;
  for (const raw of urlMatch) {
    try {
      const u = new URL(raw.replace(/[),.;]+$/, ""));
      if (isTrustedMapsUrl(u)) {
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
    return isTrustedMapsUrl(u) ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function searchPlace(query: string) {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) {
    return { degraded: true as const, results: [] as never[] };
  }
  let json: { status?: string; results?: Array<{
    place_id: string;
    name: string;
    formatted_address: string;
    geometry?: { location?: { lat: number; lng: number } };
  }> };
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`,
    );
    if (!res.ok) return { degraded: true as const, results: [] as never[] };
    json = await res.json();
  } catch {
    return { degraded: true as const, results: [] as never[] };
  }
  if (json.status && json.status !== "OK" && json.status !== "ZERO_RESULTS") {
    return { degraded: true as const, results: [] as never[] };
  }
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
