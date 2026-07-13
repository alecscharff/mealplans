import test from "node:test";
import assert from "node:assert/strict";
import { seededShuffle } from "./prng.js";

test("seededShuffle is deterministic for the same seed", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  const shuffle1 = seededShuffle(items, "2026-07-13:seed1");
  const shuffle2 = seededShuffle(items, "2026-07-13:seed1");
  assert.deepEqual(shuffle1, shuffle2);
});

test("seededShuffle differs across seeds (with overwhelming probability)", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  const shuffleA = seededShuffle(items, "2026-07-13:seed1");
  const shuffleB = seededShuffle(items, "2026-07-20:seed1");
  assert.notDeepEqual(shuffleA, shuffleB);
});

test("seededShuffle preserves the same set of items", () => {
  const items = [1, 2, 3, 4, 5];
  const shuffled = seededShuffle(items, "some-seed");
  assert.deepEqual([...shuffled].sort(), [...items].sort());
});

test("seededShuffle does not mutate the input array", () => {
  const items = [1, 2, 3, 4, 5];
  const copy = items.slice();
  seededShuffle(items, "some-seed");
  assert.deepEqual(items, copy);
});
