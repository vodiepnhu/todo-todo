import assert from "node:assert/strict";
import { deterministicUuid } from "./copy-demo-drafts.mjs";

const first = deterministicUuid("item", "00000000-0000-0000-0000-000000000001");
const second = deterministicUuid("item", "00000000-0000-0000-0000-000000000001");

assert.match(first, /^[0-9a-f-]{36}$/);
assert.equal(first, second);
assert.notEqual(
  first,
  deterministicUuid("item", "00000000-0000-0000-0000-000000000002"),
);

console.log("demo draft copy mapping checks passed");
