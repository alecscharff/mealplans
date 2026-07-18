import test from "node:test";
import assert from "node:assert/strict";
import { deriveProteinTag, deriveStyleTags, deriveTags, PROTEIN_TAG_OPTIONS } from "./recipeTags.js";

test("PROTEIN_TAG_OPTIONS covers every deriveProteinTag() outcome", () => {
  assert.deepEqual(PROTEIN_TAG_OPTIONS, ["Turkey", "Chicken", "Beef", "Pork", "Seafood", "Vegetarian"]);
});

test("deriveProteinTag detects chicken", () => {
  assert.equal(deriveProteinTag({ name: "Sheet Pan BBQ Chicken", ingredientsRaw: "12 oz Chicken Cutlets" }), "Chicken");
});

test("deriveProteinTag detects turkey", () => {
  assert.equal(deriveProteinTag({ name: "One-Pot Cowboy Turkey & Bean Chili", ingredientsRaw: "1 lb Ground Turkey" }), "Turkey");
});

test("deriveProteinTag detects beef, pork, and seafood", () => {
  assert.equal(deriveProteinTag({ name: "Steak Tacos", ingredientsRaw: "1 lb Steak" }), "Beef");
  assert.equal(deriveProteinTag({ name: "Bacon Carbonara", ingredientsRaw: "4 oz Bacon" }), "Pork");
  assert.equal(deriveProteinTag({ name: "Lemon Salmon", ingredientsRaw: "12 oz Salmon" }), "Seafood");
});

test("deriveProteinTag defaults to Vegetarian when no meat keyword is present", () => {
  assert.equal(deriveProteinTag({ name: "Creamy Butternut Squash Cavatappi", ingredientsRaw: "1 cup Kale" }), "Vegetarian");
});

test("deriveStyleTags flags one-pot/sheet-pan/skillet recipes", () => {
  assert.deepEqual(deriveStyleTags({ name: "Sheet Pan BBQ Chicken", totalTimeMinutes: 35 }), ["One-Pot"]);
  assert.deepEqual(deriveStyleTags({ name: "One-Pot Turkey Chili", totalTimeMinutes: 45 }), ["One-Pot"]);
});

test("deriveStyleTags flags quick recipes and explicitly 'simple'/'easy' ones as Easy Prep", () => {
  assert.deepEqual(deriveStyleTags({ name: "Weeknight Pasta", totalTimeMinutes: 25 }), ["Easy Prep"]);
  assert.deepEqual(deriveStyleTags({ name: "Simple Chimi Chimi Chicken", totalTimeMinutes: 40 }), ["Easy Prep"]);
});

test("deriveStyleTags can return both tags, or none", () => {
  assert.deepEqual(deriveStyleTags({ name: "Easy Sheet Pan Chicken", totalTimeMinutes: 20 }), ["One-Pot", "Easy Prep"]);
  assert.deepEqual(deriveStyleTags({ name: "Homestyle Chicken Pot Pie", totalTimeMinutes: 55 }), []);
});

test("deriveTags combines the protein tag with style tags", () => {
  assert.deepEqual(deriveTags({ name: "Sheet Pan BBQ Chicken", ingredientsRaw: "Chicken", totalTimeMinutes: 35 }), [
    "Chicken",
    "One-Pot",
  ]);
});
