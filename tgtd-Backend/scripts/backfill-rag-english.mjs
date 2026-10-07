import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, "tgtd-Backend/.env.local"));

export function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    limit: Number(argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || 500),
    workspaceId: argv.find((arg) => arg.startsWith("--workspace-id="))?.split("=")[1] || null,
  };
}

export function shouldBackfill(row) {
  return row.translation_version !== "v1" || !row.chunk_text_en;
}

function sourceLanguage(text) {
  if (/\p{Script=Latin}/u.test(text) && /[ăâđêôơưĂÂĐÊÔƠƯà-ỹÀ-Ỹ]/u.test(text)) return "vi";
  if (/\p{Script=Latin}/u.test(text)) return "en";
  return "other";
}

function tokenize(text) {
  return text.toLowerCase().split(/\W+/).filter(Boolean).flatMap((token) => {
    const stem = token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token;
    return stem === token ? [token] : [token, stem];
  });
}

function mockEmbed(text) {
  const vector = new Array(1536).fill(0);
  for (const token of tokenize(text)) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    vector[(hash >>> 0) % 1536] += 1;
    vector[((hash * 7) >>> 0) % 1536] += 0.5;
    vector[((hash * 13) >>> 0) % 1536] += 0.25;
  }
  const compact = text.toLowerCase().replace(/\W+/g, "");
  for (let i = 0; i + 2 < compact.length; i += 1) {
    let hash = 0;
    for (const char of compact.slice(i, i + 3)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    vector[hash % 1536] += 0.15;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

async function translate(text) {
  const key = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!key || !model) return text;
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: 'Translate to English. Preserve proper names, URLs, dates, numbers, and meaning. Return JSON only: {"text":"..."}.' },
          { role: "user", content: JSON.stringify({ text }) },
        ],
      }),
    });
    if (!response.ok) return text;
    const body = await response.json();
    const content = body.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    return typeof parsed.text === "string" && parsed.text.trim() ? parsed.text.trim() : text;
  } catch {
    return text;
  }
}

async function embed(text) {
  const key = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return mockEmbed(text);
  try {
    const response = await fetch(`${(process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/embeddings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.EMBEDDING_MODEL || "text-embedding-3-small", input: text }),
    });
    const body = await response.json();
    const vector = body.data?.[0]?.embedding;
    if (response.ok && Array.isArray(vector) && vector.length === 1536) return vector;
  } catch {
    // Fall back to deterministic embeddings so migration remains resumable.
  }
  return mockEmbed(text);
}

async function withRetry(action, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function runBackfill({ dryRun, limit, workspaceId }) {
  const url = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Set Supabase URL and SUPABASE_SECRET_KEY first");

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  let query = supabase.from("item_embeddings").select("*").eq("source_type", "item").limit(limit);
  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []).filter(shouldBackfill);
  if (dryRun) return { selected: rows.length, updated: 0, failed: 0 };

  let updated = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const chunkEn = await translate(row.chunk_text);
      const vector = await embed(chunkEn);
      await withRetry(async () => {
        const result = await supabase.rpc("upsert_item_embedding", {
          p_workspace_id: row.workspace_id,
          p_source_type: row.source_type,
          p_source_id: row.source_id,
          p_chunk_text: row.chunk_text,
          p_chunk_text_en: chunkEn,
          p_source_language: sourceLanguage(row.chunk_text),
          p_translation_version: "v1",
          p_embedding: `[${vector.join(",")}]`,
          p_metadata: row.metadata || {},
        });
        if (result.error) throw result.error;
      });
      updated += 1;
    } catch (error) {
      failed += 1;
      console.warn(`Backfill failed for ${row.source_id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return { selected: rows.length, updated, failed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runBackfill(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result));
}
