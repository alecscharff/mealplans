import test from "node:test";
import assert from "node:assert/strict";
import { parseIngredientLine, parseIngredientsRaw } from "./ingredientParser.js";

test("parses a simple whole-number quantity with unit", () => {
  assert.deepEqual(parseIngredientLine("2 cups flour"), {
    quantity: 2,
    unit: "cup",
    name: "flour",
    raw: "2 cups flour",
  });
});

test("parses a mixed-number quantity", () => {
  const result = parseIngredientLine("1 1/2 lb chicken breast");
  assert.equal(result.quantity, 1.5);
  assert.equal(result.unit, "lb");
  assert.equal(result.name, "chicken breast");
});

test("parses a unicode fraction quantity", () => {
  const result = parseIngredientLine("½ tsp salt");
  assert.equal(result.quantity, 0.5);
  assert.equal(result.unit, "tsp");
  assert.equal(result.name, "salt");
});

test("parses a mixed unicode fraction (whole number + fraction glyph)", () => {
  const result = parseIngredientLine("1½ cups sugar");
  assert.equal(result.quantity, 1.5);
  assert.equal(result.unit, "cup");
  assert.equal(result.name, "sugar");
});

test("parses a range quantity as the average", () => {
  const result = parseIngredientLine("3-4 cloves garlic, minced");
  assert.equal(result.quantity, 3.5);
  assert.equal(result.unit, "clove");
  assert.equal(result.name, "garlic, minced");
});

test("falls back to raw text with null quantity/unit for unparseable lines", () => {
  const result = parseIngredientLine("Salt and pepper to taste");
  assert.deepEqual(result, {
    quantity: null,
    unit: null,
    name: "Salt and pepper to taste",
    raw: "Salt and pepper to taste",
  });
});

test("handles a quantity with no recognizable unit (name includes the leftover word)", () => {
  const result = parseIngredientLine("2 large eggs");
  assert.equal(result.quantity, 2);
  assert.equal(result.unit, null);
  assert.equal(result.name, "large eggs");
});

test("parseIngredientsRaw splits and parses a whole raw ingredient block, skipping blank lines", () => {
  const raw = "2 cups flour\n\n1/2 tsp salt\nSalt and pepper to taste\n";
  const results = parseIngredientsRaw(raw);
  assert.equal(results.length, 3);
  assert.equal(results[0].name, "flour");
  assert.equal(results[1].quantity, 0.5);
  assert.equal(results[2].quantity, null);
});
