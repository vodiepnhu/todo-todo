import { searchPlace } from "../lib/maps/maps";

export type PlaceCandidate = {
  googlePlaceId: string;
  name: string;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
};

export type PlaceResolution = {
  placeQuery?: string;
  googleMapsUrl?: string;
  googlePlaceId?: string;
  name?: string;
  formattedAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
  degraded: boolean;
  note?: string;
};

export type ResolvePlaceInput = {
  message: string;
  placeQuery?: string;
  googleMapsUrl?: string;
  extractMapsUrl: (text: string) => string | undefined;
  safeMapsUrl: (url: string) => string | null;
  searchPlace?: (
    query: string,
  ) => Promise<{ degraded: boolean; results: PlaceCandidate[] }>;
};

function mapsUrlFromPlace(p: PlaceCandidate): string {
  if (p.latitude != null && p.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;
  }
  const q = encodeURIComponent(p.formattedAddress || p.name);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/**
 * Places agent — resolve placeQuery / maps URL.
 * Degrades (keeps placeQuery only) when Maps API unavailable.
 */
export async function resolvePlace(
  input: ResolvePlaceInput,
): Promise<PlaceResolution> {
  const fromItem = input.googleMapsUrl
    ? input.safeMapsUrl(input.googleMapsUrl)
    : null;
  const fromMessage = input.extractMapsUrl(input.message);
  const trustedFromMessage = fromMessage
    ? input.safeMapsUrl(fromMessage)
    : null;
  const mapsUrl = fromItem || trustedFromMessage || undefined;

  if (mapsUrl) {
    return {
      placeQuery: input.placeQuery,
      googleMapsUrl: mapsUrl,
      degraded: false,
    };
  }

  const query = input.placeQuery?.trim();
  if (!query) {
    return { degraded: false };
  }

  const search = input.searchPlace ?? defaultSearch;
  const found = await search(query);
  const top = found.results[0];
  if (found.degraded || !top) {
    return {
      placeQuery: query,
      degraded: true,
      note: "Maps lookup unavailable — kept place query only",
    };
  }

  return {
    placeQuery: query,
    googleMapsUrl: mapsUrlFromPlace(top),
    googlePlaceId: top.googlePlaceId,
    name: top.name,
    formattedAddress: top.formattedAddress,
    latitude: top.latitude,
    longitude: top.longitude,
    degraded: false,
  };
}

async function defaultSearch(query: string) {
  const res = await searchPlace(query);
  return {
    degraded: res.degraded,
    results: res.results as PlaceCandidate[],
  };
}
