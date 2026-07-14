import test from "node:test";
import assert from "node:assert/strict";
import { generateCandidates } from "./candidates.js";

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
