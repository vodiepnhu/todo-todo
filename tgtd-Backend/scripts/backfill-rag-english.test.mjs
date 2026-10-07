import assert from "node:assert/strict";
import test from "node:test";
import { parseArgs, shouldBackfill } from "./backfill-rag-english.mjs";

test("backfill args support dry-run, limit, and workspace scope", () => {
  assert.deepEqual(parseArgs(["--dry-run", "--limit=12", "--workspace-id=w1"]), {
    dryRun: true,
    limit: 12,
    workspaceId: "w1",
  });
});

test("backfill skips rows already written with current translation version", () => {
  assert.equal(shouldBackfill({ translation_version: "v1", chunk_text_en: "English" }), false);
  assert.equal(shouldBackfill({ translation_version: "legacy", chunk_text_en: "Original" }), true);
});
