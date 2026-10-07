import { chatCompletionJson } from "./providers";
import { resolveLlmCallConfig } from "../../services/llm-settings-service";

const TRANSLATION_SYSTEM = `Translate user text to English for search indexing.
Return only valid JSON: {"text":"..."}.
Preserve place names, brands, product names, URLs, numbers, dates, durations, and proper nouns.
Do not add explanation or change meaning.`;

export async function translateTextToEnglish(
  userId: string,
  text: string,
): Promise<string> {
  const original = text.trim();
  if (!original) return original;

  try {
    const config = await resolveLlmCallConfig(userId);
    if (!config) return original;
    const result = await chatCompletionJson(config, [
      { role: "system", content: TRANSLATION_SYSTEM },
      { role: "user", content: JSON.stringify({ text: original }) },
    ]);
    const parsed = JSON.parse(result.content) as { text?: unknown };
    return typeof parsed.text === "string" && parsed.text.trim()
      ? parsed.text.trim()
      : original;
  } catch {
    return original;
  }
}
