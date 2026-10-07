import assert from "node:assert/strict";
import { buildDemoSeed, findUserByEmail } from "./seed-demo-data.mjs";

assert.equal(
  findUserByEmail(
    { users: [{ id: "user-1", email: "demo@local.test" }] },
    "demo@local.test",
  ).id,
  "user-1",
);

const seed = buildDemoSeed("user-1", new Date("2026-10-06T00:00:00.000Z"));

assert.deepEqual(
  seed.projects.map((project) => project.name),
  ["Sydney", "Bowral", "Taipei", "TaiChung", "Bangkok", "Personal"],
);
assert.equal(seed.projects.length, 6);
assert.equal(seed.items.length, 90);
assert.equal(new Set(seed.items.map((item) => item.category)).size, 14);
assert.equal(new Set(seed.items.map((item) => item.planned_start_at)).size >= 80, true);
assert.equal(seed.places.length, 90);
assert.equal(seed.itemPlaces.length, 90);
assert.equal(seed.planTravel.length, 90);
assert.equal(seed.planActivities.length >= 90, true);
assert.equal(seed.planFood.length >= 90, true);
assert.equal(seed.planPreparations.length >= 90, true);
assert.equal(seed.planTodos.length >= 90, true);
assert.equal(seed.planCosts.length >= 90, true);
assert.equal(seed.planNotes.length >= 90, true);
for (const project of seed.projects) {
  const items = seed.items.filter((item) => item.workspace_id === project.id);
  assert.equal(items.length, 15);
  for (const item of items) {
    assert.equal(item.item_type, "ACTIVITY");
    assert.equal(item.subtype, "TASK");
    assert.ok(item.description);
    assert.ok(item.category_label);
    assert.ok(item.due_at);
    assert.ok(item.planned_start_at);
    assert.ok(item.estimated_duration_min);
    assert.ok(item.best_time);
  }
}

console.log("demo data shape checks passed");
