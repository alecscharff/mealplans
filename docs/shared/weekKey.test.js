import test from "node:test";
import assert from "node:assert/strict";
import { weekKey, weekday } from "./weekKey.js";

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

test("weekday: Monday=0 ... Sunday=6", () => {
  assert.equal(weekday(new Date(2026, 6, 13)), 0); // Monday
  assert.equal(weekday(new Date(2026, 6, 16)), 3); // Thursday
  assert.equal(weekday(new Date(2026, 6, 19)), 6); // Sunday
});
