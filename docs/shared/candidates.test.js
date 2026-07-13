import test from "node:test";
import assert from "node:assert/strict";
import { generateCandidates, applyDeadlineAutoPick } from "./candidates.js";

function recipe(uid, lastCooked) {
  return { uid, name: uid, lastCooked };
}

test("generateCandidates prefers least-recently-cooked recipes and never-cooked ones", () => {
  const recipes = [
    recipe("r1", "2026-01-01"),
    recipe("r2", "2026-06-01"),
    recipe("r3", null), // never cooked -> should be in the pool
    recipe("r4", "2026-05-01"),
    recipe("r5", "2026-04-01"),
    recipe("r6", "2026-03-01"),
    recipe("r7", "2026-02-01"),
    recipe("r8", "2026-07-01"), // most recently cooked -> should be excluded from a 9-pool of 9 total items? here only 8 total
    recipe("r9", "2025-12-01"),
  ];
  const candidates = generateCandidates(recipes, "2026-07-13", "seed", { poolSize: 5, takeCount: 5 });
  assert.equal(candidates.length, 5);
  // The 5 least-recently-cooked (r3 null, r9, r1, r7, r6) should all appear.
  assert.deepEqual([...candidates].sort(), ["r1", "r3", "r6", "r7", "r9"].sort());
});

test("generateCandidates is deterministic for a given weekKey + seed", () => {
  const recipes = Array.from({ length: 12 }, (_, i) => recipe(`r${i}`, `2026-01-${String(i + 1).padStart(2, "0")}`));
  const a = generateCandidates(recipes, "2026-07-13", "family-seed");
  const b = generateCandidates(recipes, "2026-07-13", "family-seed");
  assert.deepEqual(a, b);
});

test("applyDeadlineAutoPick does nothing before the deadline", () => {
  const result = applyDeadlineAutoPick({
    todayWeekday: 1,
    deadlineDay: 3,
    candidates: ["r1", "r2", "r3"],
    recipesByUid: { r1: recipe("r1", "2026-01-01"), r2: recipe("r2", "2026-01-02"), r3: recipe("r3", "2026-01-03") },
    picks: [],
    autoPickedIds: [],
  });
  assert.deepEqual(result.picks, []);
  assert.deepEqual(result.autoPickedIds, []);
});

test("applyDeadlineAutoPick does nothing once 2 picks already exist", () => {
  const result = applyDeadlineAutoPick({
    todayWeekday: 5,
    deadlineDay: 3,
    candidates: ["r1", "r2", "r3"],
    recipesByUid: { r1: recipe("r1", "2026-01-01"), r2: recipe("r2", "2026-01-02"), r3: recipe("r3", "2026-01-03") },
    picks: ["r1", "r2"],
    autoPickedIds: [],
  });
  assert.deepEqual(result.picks, ["r1", "r2"]);
  assert.deepEqual(result.autoPickedIds, []);
});

test("applyDeadlineAutoPick fills remaining slots by least-recently-cooked at/after the deadline", () => {
  const result = applyDeadlineAutoPick({
    todayWeekday: 3,
    deadlineDay: 3,
    candidates: ["r1", "r2", "r3"],
    recipesByUid: {
      r1: recipe("r1", "2026-03-01"),
      r2: recipe("r2", "2026-01-01"), // least recently cooked
      r3: recipe("r3", "2026-02-01"),
    },
    picks: ["r1"],
    autoPickedIds: [],
  });
  assert.deepEqual(result.picks, ["r1", "r2"]);
  assert.deepEqual(result.autoPickedIds, ["r2"]);
});
