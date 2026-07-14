import test from "node:test";
import assert from "node:assert/strict";
import { HELLOFRESH_SPICE_BLENDS, findSpiceBlend } from "./hellofreshSpiceBlends.js";

test("every blend has a name and at least one line", () => {
  for (const blend of HELLOFRESH_SPICE_BLENDS) {
    assert.equal(typeof blend.name, "string");
    assert.ok(blend.name.length > 0);
    assert.ok(Array.isArray(blend.lines) && blend.lines.length > 0);
  }
});

test("findSpiceBlend matches a plain blend name", () => {
  const match = findSpiceBlend("Southwest Spice Blend");
  assert.equal(match.name, "Southwest Spice Blend");
});

test("findSpiceBlend matches case-insensitively within a full ingredient line", () => {
  const match = findSpiceBlend("1 tablespoon shawarma spice blend");
  assert.equal(match.name, "Shawarma Spice Blend");
});

test("findSpiceBlend prefers the more specific/longer name over a shorter overlapping one", () => {
  const match = findSpiceBlend("2 tsp Bold & Savory Steak Spice Blend");
  assert.equal(match.name, "Bold & Savory Steak Spice Blend");
});

test("findSpiceBlend returns null for a non-blend ingredient", () => {
  assert.equal(findSpiceBlend("2 cups flour"), null);
  assert.equal(findSpiceBlend(""), null);
  assert.equal(findSpiceBlend(null), null);
});
