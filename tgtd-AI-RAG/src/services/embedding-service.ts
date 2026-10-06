export const EMBEDDING_DIM = 1536;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean)
    .flatMap((t) => {
      const stem = t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t;
      return stem === t ? [t] : [t, stem];
    });
}

/** Deterministic local embed — demo / no API key. L2-normalized. */
export function mockEmbed(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);
  const tokens = tokenize(text);
  for (const t of tokens) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const i1 = (h >>> 0) % EMBEDDING_DIM;
    const i2 = ((h * 7) >>> 0) % EMBEDDING_DIM;
    const i3 = ((h * 13) >>> 0) % EMBEDDING_DIM;
    vec[i1] += 1;
    vec[i2] += 0.5;
    vec[i3] += 0.25;
  }
  // char trigrams for soft overlap (grocery ≈ groceries)
  const compact = text.toLowerCase().replace(/\W+/g, "");
  for (let i = 0; i + 2 < compact.length; i++) {
    const tri = compact.slice(i, i + 3);
    let h = 0;
    for (let j = 0; j < tri.length; j++) h = (h * 31 + tri.charCodeAt(j)) >>> 0;
    vec[h % EMBEDDING_DIM] += 0.15;
  }
  return l2Normalize(vec);
}

export function l2Normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm = Math.sqrt(sum) || 1;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i]! * b[i]!;
  return dot;
}

export async function embedText(text: string): Promise<{
  embedding: number[];
  mocked: boolean;
  model: string;
}> {
  const key =
    process.env.EMBEDDING_API_KEY ||
    process.env.OPENAI_API_KEY ||
    undefined;
  const model =
    process.env.EMBEDDING_MODEL || "text-embedding-3-small";

  if (!key) {
    return { embedding: mockEmbed(text), mocked: true, model: "mock-embed" };
  }

  try {
    const base =
      process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1";
    const res = await fetch(`${base.replace(/\/$/, "")}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input: text }),
    });
    if (!res.ok) throw new Error(`embed ${res.status}`);
    const json = (await res.json()) as {
      data?: { embedding: number[] }[];
    };
    const embedding = json.data?.[0]?.embedding;
    if (!embedding?.length) throw new Error("empty embedding");
    return { embedding: l2Normalize(embedding), mocked: false, model };
  } catch {
    return { embedding: mockEmbed(text), mocked: true, model: "mock-embed-fallback" };
  }
}

export function vectorToPgLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
