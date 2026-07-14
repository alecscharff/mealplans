import test from "node:test";
import assert from "node:assert/strict";
import { computeRollover } from "./rollover.js";

test("computeRollover ignores the current week", () => {
  const result = computeRollover(
    [{ weekKey: "2026-07-13", picks: ["r1", "r2"], archived: false }],
    "2026-07-13"
  );
  assert.deepEqual(result.historyAppends, []);
  assert.deepEqual(result.archivedWeekKeys, []);
});

test("computeRollover ignores future weeks (planned ahead via the 4-week menu view)", () => {
  const result = computeRollover(
    [
      { weekKey: "2026-07-20", picks: ["r1", "r2"], archived: false },
      { weekKey: "2026-07-27", picks: [], archived: false },
    ],
    "2026-07-13"
  );
  assert.deepEqual(result.historyAppends, []);
  assert.deepEqual(result.archivedWeekKeys, []);
});

test("computeRollover ignores already-archived weeks", () => {
  const result = computeRollover(
    [{ weekKey: "2026-07-06", picks: ["r1", "r2"], archived: true }],
    "2026-07-13"
  );
  assert.deepEqual(result.historyAppends, []);
  assert.deepEqual(result.archivedWeekKeys, []);
});

test("computeRollover archives a past week with picks: logs history, updates lastCooked, marks archived", () => {
  const now = new Date("2026-07-13T12:00:00Z");
  const result = computeRollover(
    [{ weekKey: "2026-07-06", picks: ["r1", "r2"], archived: false }],
    "2026-07-13",
    now
  );
  assert.deepEqual(result.historyAppends, [
    { weekKey: "2026-07-06", recipeUids: ["r1", "r2"], loggedAt: now.toISOString() },
  ]);
  assert.deepEqual(result.lastCookedUpdates, { r1: "2026-07-06", r2: "2026-07-06" });
  assert.deepEqual(result.archivedWeekKeys, ["2026-07-06"]);
});

test("computeRollover archives a past week with no picks, but doesn't log history", () => {
  const result = computeRollover(
    [{ weekKey: "2026-07-06", picks: [], archived: false }],
    "2026-07-13"
  );
  assert.deepEqual(result.historyAppends, []);
  assert.deepEqual(result.lastCookedUpdates, {});
  assert.deepEqual(result.archivedWeekKeys, ["2026-07-06"]);
});

test("computeRollover handles multiple stale weeks in one pass", () => {
  const result = computeRollover(
    [
      { weekKey: "2026-06-29", picks: ["r1"], archived: false },
      { weekKey: "2026-07-06", picks: ["r2"], archived: false },
      { weekKey: "2026-07-13", picks: [], archived: false },
    ],
    "2026-07-13"
  );
  assert.deepEqual(result.archivedWeekKeys, ["2026-06-29", "2026-07-06"]);
  assert.deepEqual(result.lastCookedUpdates, { r1: "2026-06-29", r2: "2026-07-06" });
});
