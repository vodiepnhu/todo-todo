import { describe, expect, it } from "vitest";
import { getDictionary, type Locale } from "@/lib/i18n";

describe("app locale dictionary", () => {
  it("provides English and Vietnamese UI labels", () => {
    expect(getDictionary("en").nav.settings).toBe("Settings");
    expect(getDictionary("vi").nav.settings).toBe("Cài đặt");
  });

  it("supports only app locales", () => {
    const locale: Locale = "vi";
    expect(getDictionary(locale).localeLabel).toBe("Tiếng Việt");
  });
});
