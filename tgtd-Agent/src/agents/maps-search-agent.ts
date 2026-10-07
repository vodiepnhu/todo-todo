import { googleMapsPlaceUrl, searchPlace } from "../lib/maps/maps";

export type MapsSearchHit = {
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string;
};

function mapsUrlFromHit(p: {
  name: string;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string;
}): string {
  return googleMapsPlaceUrl(p);
}

/**
 * Maps / Places search agent — resolve a place name to a Google Maps URL.
 * Uses Google Places Text Search when GOOGLE_MAPS_SERVER_API_KEY is set;
 * otherwise returns degraded (no invent).
 */
export async function runMapsSearchAgent(input: {
  query: string;
}): Promise<{
  degraded: boolean;
  hits: MapsSearchHit[];
  topMapsUrl: string | null;
  note?: string;
}> {
  const query = input.query.trim();
  if (!query) {
    return { degraded: false, hits: [], topMapsUrl: null, note: "Empty query" };
  }
  const found = await searchPlace(query);
  if (found.degraded) {
    return {
      degraded: true,
      hits: [],
      topMapsUrl: googleMapsPlaceUrl({ name: query }),
      note: "Maps API unavailable — using free Google Maps search",
    };
  }
  const hits: MapsSearchHit[] = found.results.map(
    (r: {
      googlePlaceId: string;
      name: string;
      formattedAddress: string;
      latitude: number | null;
      longitude: number | null;
    }) => ({
      ...r,
      googleMapsUrl: mapsUrlFromHit(r),
    }),
  );
  return {
    degraded: false,
    hits,
    topMapsUrl: hits[0]?.googleMapsUrl ?? null,
  };
}
