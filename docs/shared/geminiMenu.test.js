import assert from "node:assert/strict";
import { test } from "node:test";
import { validateGeminiPlan } from "../../functions/geminiMenu.js";

const first = "2026-11-15";
const next = "2026-11-22";
const weeks = {
  [first]: { picks: ["salmon", "soup"], candidates: ["salmon", "soup", "tacos", "rice"] },
  [next]: null,
};
const recipes = [
  { uid: "salmon" },
  { uid: "soup" },
  { uid: "tacos" },
  { uid: "rice", skipped: true },
];

test("validates a cross-week move and preserves the other pick", () => {
  assert.deepEqual(validateGeminiPlan({ changes: [
    { week: first, picks: ["tacos", "soup"] },
    { week: next, picks: ["salmon"] },
  ] }, weeks, recipes), [
    { week: first, picks: ["tacos", "soup"], candidates: ["tacos", "soup", "salmon", "rice"] },
    { week: next, picks: ["salmon"], candidates: ["salmon"] },
  ]);
});

test("rejects unknown or skipped additions and changes outside the planner", () => {
  for (const uid of ["unknown", "rice"]) {
    assert.equal(validateGeminiPlan({ changes: [{ week: next, picks: [uid] }] }, weeks, recipes), null);
  }
  assert.equal(validateGeminiPlan({ changes: [{ week: "2026-11-08", picks: ["salmon"] }] }, weeks, recipes), null);
  assert.equal(validateGeminiPlan({ changes: [{ week: first, picks: ["salmon", "salmon"] }] }, weeks, recipes), null);
});
