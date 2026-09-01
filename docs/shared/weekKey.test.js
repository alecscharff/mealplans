import test from "node:test";
import assert from "node:assert/strict";
import { weekKey, addWeeks, weeksBetween, addDays } from "./weekKey.js";

test("weekKey returns the Sunday of the week for a mid-week date", () => {
  // Thursday 2026-07-16 -> Sunday 2026-07-12
  assert.equal(weekKey(new Date(2026, 6, 16)), "2026-07-12");
});

test("weekKey returns the same Sunday for the Sunday itself", () => {
  assert.equal(weekKey(new Date(2026, 6, 12)), "2026-07-12");
});

test("weekKey handles Saturday correctly (rolls back to that week's Sunday)", () => {
  // Saturday 2026-07-18 -> Sunday 2026-07-12
  assert.equal(weekKey(new Date(2026, 6, 18)), "2026-07-12");
});

test("weekKey handles month/year boundaries", () => {
  // Friday 2027-01-01 -> Sunday 2026-12-27
  assert.equal(weekKey(new Date(2027, 0, 1)), "2026-12-27");
});

test("addWeeks steps forward by whole weeks", () => {
  assert.equal(addWeeks("2026-07-12", 1), "2026-07-19");
  assert.equal(addWeeks("2026-07-12", 3), "2026-08-02");
});

test("addWeeks handles n=0 and negative n", () => {
  assert.equal(addWeeks("2026-07-12", 0), "2026-07-12");
  assert.equal(addWeeks("2026-07-12", -1), "2026-07-05");
});

test("addWeeks crosses month/year boundaries correctly", () => {
  assert.equal(addWeeks("2026-12-27", 1), "2027-01-03");
});

test("weeksBetween is 0 for the same week", () => {
  assert.equal(weeksBetween("2026-07-12", "2026-07-12"), 0);
});

test("weeksBetween is positive when `to` is later", () => {
  assert.equal(weeksBetween("2026-07-12", "2026-08-02"), 3);
});

test("weeksBetween is negative when `to` is earlier", () => {
  assert.equal(weeksBetween("2026-08-02", "2026-07-12"), -3);
});

test("weeksBetween crosses month/year boundaries correctly", () => {
  assert.equal(weeksBetween("2026-12-27", "2027-01-10"), 2);
});

test("addDays steps forward and backward by days", () => {
  assert.equal(addDays("2026-07-12", 1), "2026-07-13");
  assert.equal(addDays("2026-07-12", -1), "2026-07-11");
  assert.equal(addDays("2026-07-12", 0), "2026-07-12");
});

test("addDays crosses month/year boundaries correctly", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
