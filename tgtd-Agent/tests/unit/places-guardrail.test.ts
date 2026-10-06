import { describe, expect, it, vi } from "vitest";
import { resolvePlace } from "@/agents/places-agent";
import {
  extractGoogleMapsUrl,
  safeMapsRedirect,
  searchPlace,
} from "@/lib/maps/maps";
import {
  shouldClarify,
  validateMutationDraft,
  validatePendingPayload,
} from "@/agents/guardrail-agent";
import { buildMutationDraft } from "@/agents/mutation-agent";

describe("places-agent", () => {
  it("keeps trusted maps URL from message", async () => {
    const r = await resolvePlace({
      message: "add cafe https://maps.app.goo.gl/abc",
      placeQuery: "cafe",
      extractMapsUrl: () => "https://maps.app.goo.gl/abc",
      safeMapsUrl: (u) => u,
    });
    expect(r.googleMapsUrl).toBe("https://maps.app.goo.gl/abc");
    expect(r.degraded).toBe(false);
  });

  it("resolves placeQuery via search when no URL", async () => {
    const search = vi.fn().mockResolvedValue({
      degraded: false,
      results: [
        {
          googlePlaceId: "pid1",
          name: "IKEA Tempe",
          formattedAddress: "Tempe NSW",
          latitude: -33.9,
          longitude: 151.1,
        },
      ],
    });
    const r = await resolvePlace({
      message: "add IKEA Tempe",
      placeQuery: "IKEA Tempe",
      extractMapsUrl: () => undefined,
      safeMapsUrl: (u) => u,
      searchPlace: search,
    });
    expect(search).toHaveBeenCalledWith("IKEA Tempe");
    expect(r.name).toBe("IKEA Tempe");
    expect(r.googlePlaceId).toBe("pid1");
    expect(r.googleMapsUrl).toContain("google.com/maps");
    expect(r.degraded).toBe(false);
  });

  it("degrades when search unavailable", async () => {
    const r = await resolvePlace({
      message: "add beach",
      placeQuery: "Manly Beach",
      extractMapsUrl: () => undefined,
      safeMapsUrl: () => null,
      searchPlace: async () => ({ degraded: true, results: [] }),
    });
    expect(r.degraded).toBe(true);
    expect(r.placeQuery).toBe("Manly Beach");
    expect(r.googleMapsUrl).toBeUndefined();
  });

  it("uses place id and preserves resolved place metadata", async () => {
    const r = await resolvePlace({
      message: "IKEA Tempe",
      placeQuery: "IKEA Tempe",
      extractMapsUrl: () => undefined,
      safeMapsUrl: safeMapsRedirect,
      searchPlace: async () => ({
        degraded: false,
        results: [{
          googlePlaceId: "pid1",
          name: "IKEA Tempe",
          formattedAddress: "1 O'Riordan St, Tempe NSW",
          latitude: -33.925,
          longitude: 151.168,
        }],
      }),
    });
    expect(r.googleMapsUrl).toContain("query_place_id=pid1");
    expect(r.formattedAddress).toBe("1 O'Riordan St, Tempe NSW");
    expect(r.latitude).toBe(-33.925);
  });

  it("rejects unsafe or non-Maps Google URLs", () => {
    expect(safeMapsRedirect("https://evil.example/maps/bondi")).toBeNull();
    expect(safeMapsRedirect("https://www.google.com/search?q=evil")).toBeNull();
    expect(extractGoogleMapsUrl("https://evil.example/maps/bondi")).toBeNull();
  });

  it("keeps ambiguous zero-result queries without fabricating a URL", async () => {
    const r = await resolvePlace({
      message: "somewhere",
      placeQuery: "somewhere",
      extractMapsUrl: () => undefined,
      safeMapsUrl: safeMapsRedirect,
      searchPlace: async () => ({ degraded: false, results: [] }),
    });
    expect(r.degraded).toBe(false);
    expect(r.googleMapsUrl).toBeUndefined();
    expect(r.note).toMatch(/No matching place/);
  });

  it("reports missing Maps configuration and provider failures as degraded", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", "");
    await expect(searchPlace("Bondi Beach")).resolves.toMatchObject({
      degraded: true,
      results: [],
    });

    vi.stubEnv("GOOGLE_MAPS_SERVER_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(searchPlace("Bondi Beach")).resolves.toMatchObject({
      degraded: true,
      results: [],
    });
  });
});

describe("guardrail-agent", () => {
  it("rejects CREATE without title", () => {
    const draft = buildMutationDraft({
      intent: "CREATE_ITEM",
      message: "add something",
      items: [{}],
      extractMapsUrl: () => undefined,
    });
    const v = validateMutationDraft(draft);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reasons.join(" ")).toMatch(/title/i);
  });

  it("accepts valid CREATE and strips untrusted maps URL", () => {
    const draft = buildMutationDraft({
      intent: "CREATE_ITEM",
      message: "add milk",
      items: [
        {
          title: "milk",
          itemType: "ACTIVITY",
          googleMapsUrl: "https://evil.example/phish",
        },
      ],
      extractMapsUrl: () => undefined,
    });
    const v = validateMutationDraft(draft, {
      safeMapsUrl: () => null,
    });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.draft.payload.googleMapsUrl).toBeUndefined();
  });

  it("accepts CREATE with null or non-URL googleMapsUrl (strips, does not block)", () => {
    const withNull = validatePendingPayload("CREATE", {
      title: "Haymarket",
      itemType: "ACTIVITY",
      googleMapsUrl: null,
    });
    expect(withNull.ok).toBe(true);

    const withJunk = validatePendingPayload("CREATE", {
      title: "Bondi",
      itemType: "ACTIVITY",
      googleMapsUrl: "Bondi Beach",
    });
    expect(withJunk.ok).toBe(true);
  });

  it("rejects untrusted Maps URLs inside canonical plan payloads", () => {
    const result = validateMutationDraft(
      {
        actionType: "CREATE",
        payload: {
          title: "Bondi Beach",
          schema: "plan",
          plan: { placeName: "Bondi Beach", googleMapsUrl: "https://evil.example/maps" },
        },
        draftTitle: "Bondi Beach",
      },
      { safeMapsUrl: safeMapsRedirect },
    );
    expect(result.ok).toBe(false);
  });

  it("shouldClarify on low confidence or ambiguities", () => {
    expect(
      shouldClarify({
        intent: "CREATE_ITEM",
        confidence: 0.2,
        items: [],
        ambiguities: [],
      }),
    ).toBe(true);
    expect(
      shouldClarify({
        intent: "CREATE_ITEM",
        confidence: 0.9,
        items: [],
        ambiguities: ["which Saturday?"],
      }),
    ).toBe(true);
    expect(
      shouldClarify({
        intent: "CREATE_ITEM",
        confidence: 0.9,
        items: [{ title: "x" }],
        ambiguities: [],
      }),
    ).toBe(false);
  });
});
