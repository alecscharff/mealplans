import test from "node:test";
import assert from "node:assert/strict";
import { weekKey, addWeeks, weeksBetween } from "./weekKey.js";

test("weekKey returns the Monday of the week for a mid-week date", () => {
  // Thursday 2026-07-16 -> Monday 2026-07-13
  assert.equal(weekKey(new Date(2026, 6, 16)), "2026-07-13");
});

test("weekKey returns the same Monday for the Monday itself", () => {
  assert.equal(weekKey(new Date(2026, 6, 13)), "2026-07-13");
});

test("weekKey handles Sunday correctly (rolls back to that week's Monday)", () => {
  // Sunday 2026-07-19 -> Monday 2026-07-13
  assert.equal(weekKey(new Date(2026, 6, 19)), "2026-07-13");
});

test("weekKey handles month/year boundaries", () => {
  // Friday 2027-01-01 -> Monday 2026-12-28
  assert.equal(weekKey(new Date(2027, 0, 1)), "2026-12-28");
});

test("addWeeks steps forward by whole weeks", () => {
  assert.equal(addWeeks("2026-07-13", 1), "2026-07-20");
  assert.equal(addWeeks("2026-07-13", 3), "2026-08-03");
});

test("addWeeks handles n=0 and negative n", () => {
  assert.equal(addWeeks("2026-07-13", 0), "2026-07-13");
  assert.equal(addWeeks("2026-07-13", -1), "2026-07-06");
});

test("addWeeks crosses month/year boundaries correctly", () => {
  assert.equal(addWeeks("2026-12-28", 1), "2027-01-04");
});

test("weeksBetween is 0 for the same week", () => {
  assert.equal(weeksBetween("2026-07-13", "2026-07-13"), 0);
});

test("weeksBetween is positive when `to` is later", () => {
  assert.equal(weeksBetween("2026-07-13", "2026-08-03"), 3);
});

test("weeksBetween is negative when `to` is earlier", () => {
  assert.equal(weeksBetween("2026-08-03", "2026-07-13"), -3);
});

test("weeksBetween crosses month/year boundaries correctly", () => {
  assert.equal(weeksBetween("2026-12-28", "2027-01-11"), 2);
});
