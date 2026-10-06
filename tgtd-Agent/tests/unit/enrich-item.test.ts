import { describe, expect, it, vi } from "vitest";
import {
  composeDescription,
  draftToCreatePayload,
  EnrichItemDraftSchema,
  parseDescriptionToDraft,
} from "@/lib/ai/enrich-item-draft";

vi.mock("@/services/llm-settings-service", () => ({
  resolveLlmCallConfig: vi.fn().mockResolvedValue(null),
}));

describe("enrich-item helpers", () => {
  it("composes description sections", () => {
    const draft = EnrichItemDraftSchema.parse({
      title: "IKEA Tempe",
      activities: "Browse kitchen, cafe lunch",
      foodToTry: "Swedish meatballs",
      notes: "Go early for parking",
    });
    const desc = composeDescription(draft);
    expect(desc).toContain("Activities:");
    expect(desc).toContain("Food to try:");
    expect(desc).toContain("Notes:");
  });

  it("round-trips composeDescription via parseDescriptionToDraft", () => {
    const draft = EnrichItemDraftSchema.parse({
      title: "X",
      activities: "Browse kitchen",
      foodToTry: "Meatballs",
      notes: "Park early",
    });
    const parsed = parseDescriptionToDraft(composeDescription(draft));
    expect(parsed.activities).toBe("Browse kitchen");
    expect(parsed.foodToTry).toBe("Meatballs");
    expect(parsed.notes).toBe("Park early");
  });

  it("puts unstructured description into notes", () => {
    const parsed = parseDescriptionToDraft("Just a freeform note");
    expect(parsed.notes).toBe("Just a freeform note");
    expect(parsed.activities).toBeNull();
  });

  it("maps draft to ACTIVITY + TASK", () => {
    const draft = EnrichItemDraftSchema.parse({
      title: "Buy matcha",
      placeQuery: "Chatime",
      foodToTry: "Matcha",
    });
    const payload = draftToCreatePayload(draft, "buy matcha at chatime");
    expect(payload.itemType).toBe("ACTIVITY");
    expect(payload.subtype).toBe("TASK");
    expect(payload.placeQuery).toBe("Chatime");
    expect(String(payload.description)).toContain("Matcha");
  });

  it("keeps place fields on place-like drafts", () => {
    const draft = EnrichItemDraftSchema.parse({
      title: "Bondi",
      placeQuery: "Bondi Beach",
      estimatedDurationMin: 120,
    });
    const payload = draftToCreatePayload(draft, "go to bondi");
    expect(payload.itemType).toBe("ACTIVITY");
    expect(payload.subtype).toBe("TASK");
    expect(payload.estimatedDurationMin).toBe(120);
  });

  it("includes bestTime on create payload", () => {
    const draft = EnrichItemDraftSchema.parse({
      title: "Bondi sunset",
      placeQuery: "Bondi Beach",
      estimatedDurationMin: 90,
      bestTime: "sunset",
      plannedStartAt: "2026-09-27",
    });
    const payload = draftToCreatePayload(draft, "bondi this sunday at sunset");
    expect(payload.bestTime).toBe("sunset");
    expect(payload.estimatedDurationMin).toBe(90);
    expect(payload.plannedStartAt).toBe("2026-09-27");
  });
});

describe("enrichItemDraft maps resolve", () => {
  it("fills googleMapsUrl from Places search when no pasted URL", async () => {
    const { enrichItemDraft } = await import("@/lib/ai/enrich-item");
    const search = vi.fn().mockResolvedValue({
      degraded: false,
      results: [
        {
          googlePlaceId: "pid1",
          name: "Haymarket",
          formattedAddress: "Haymarket NSW",
          latitude: -33.88,
          longitude: 151.2,
        },
      ],
    });
    const result = await enrichItemDraft({
      userId: "00000000-0000-4000-8000-000000000001",
      text: "Go to Haymarket for Lunar New Year Eve",
      deps: { searchPlace: search },
    });
    expect(search).toHaveBeenCalled();
    expect(result.draft.googleMapsUrl).toMatch(/google\.com\/maps/);
    expect(result.draft.placeQuery).toBe("Haymarket");
    expect(result.draft.estimatedDurationMin).toBeTruthy();
    expect(result.draft.bestTime).toBeTruthy();
    expect(result.mapsDegraded).toBe(false);
  });

  it("keeps pasted Maps URL and skips search", async () => {
    const { enrichItemDraft } = await import("@/lib/ai/enrich-item");
    const search = vi.fn();
    const url = "https://maps.app.goo.gl/abc123";
    const result = await enrichItemDraft({
      userId: "00000000-0000-4000-8000-000000000001",
      text: `Cafe visit ${url}`,
      deps: { searchPlace: search },
    });
    expect(result.draft.googleMapsUrl).toBe(url);
    expect(search).not.toHaveBeenCalled();
  });
});
