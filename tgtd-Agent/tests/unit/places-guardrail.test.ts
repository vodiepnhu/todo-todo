import { describe, expect, it, vi } from "vitest";
import { resolvePlace } from "@/agents/places-agent";
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
