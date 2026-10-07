import { describe, expect, it } from "vitest";
import { safeMapsHref } from "@/lib/maps/url";

describe("safeMapsHref", () => {
  it("allows Google Maps links", () => {
    expect(safeMapsHref("https://www.google.com/maps/search/?api=1&query=Bondi")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Bondi",
    );
    expect(safeMapsHref("https://maps.app.goo.gl/example")).toBe(
      "https://maps.app.goo.gl/example",
    );
  });

  it("rejects non-Maps links", () => {
    expect(safeMapsHref("https://example.com/maps")).toBeNull();
    expect(safeMapsHref("javascript:alert(1)")).toBeNull();
  });
});
