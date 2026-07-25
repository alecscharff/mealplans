import test from "node:test";
import assert from "node:assert/strict";
import { filterRecipes, isActiveForSuggestions, sortByRecentlyAdded } from "./recipeFilter.js";

const recipes = [
  { uid: "1", name: "Honey Garlic Chicken Thighs", ingredientsRaw: "chicken thighs", totalTimeMinutes: 35 },
  { uid: "2", name: "Weeknight Spaghetti with Beef Meat Sauce", ingredientsRaw: "ground beef", totalTimeMinutes: 30 },
  { uid: "3", name: "Caprese Pasta", ingredientsRaw: "mozzarella tomatoes", totalTimeMinutes: 25 },
  { uid: "4", name: "Slow Roasted Pork Shoulder", ingredientsRaw: "pork shoulder", totalTimeMinutes: 240 },
  { uid: "5", name: "Grandma's Pot Roast", ingredientsRaw: "beef chuck roast", totalTimeMinutes: null },
];

test("filterRecipes with no filters returns everything", () => {
  assert.equal(filterRecipes(recipes, {}).length, 5);
  assert.equal(filterRecipes(recipes).length, 5);
});

test("filterRecipes matches query against the name, case-insensitively", () => {
  const result = filterRecipes(recipes, { query: "chicken" });
  assert.deepEqual(result.map((r) => r.uid), ["1"]);
});

test("filterRecipes narrows by derived protein tag", () => {
  const result = filterRecipes(recipes, { protein: "Beef" });
  assert.deepEqual(result.map((r) => r.uid).sort(), ["2", "5"]);
});

test("filterRecipes caps by cook time, keeping recipes with unknown time", () => {
  const result = filterRecipes(recipes, { maxMinutes: 30 });
  assert.deepEqual(result.map((r) => r.uid).sort(), ["2", "3", "5"]);
});

test("filterRecipes composes query + protein + maxMinutes", () => {
  const result = filterRecipes(recipes, { query: "pasta", protein: "Vegetarian", maxMinutes: 30 });
  assert.deepEqual(result.map((r) => r.uid), ["3"]);
});

test("isActiveForSuggestions is true for recipes with no skipped field", () => {
  assert.equal(isActiveForSuggestions({ name: "x" }), true);
});

test("isActiveForSuggestions is false once skipped is set", () => {
  assert.equal(isActiveForSuggestions({ name: "x", skipped: true }), false);
});

test("sortByRecentlyAdded orders newest addedAt first", () => {
  const items = [
    { uid: "old", addedAt: "2026-01-01T00:00:00.000Z" },
    { uid: "newest", addedAt: "2026-07-25T00:00:00.000Z" },
    { uid: "middle", addedAt: "2026-04-01T00:00:00.000Z" },
  ];
  assert.deepEqual(
    sortByRecentlyAdded(items).map((r) => r.uid),
    ["newest", "middle", "old"]
  );
});

test("sortByRecentlyAdded sorts recipes with no addedAt to the end", () => {
  const items = [
    { uid: "no-date" },
    { uid: "has-date", addedAt: "2026-01-01T00:00:00.000Z" },
  ];
  assert.deepEqual(
    sortByRecentlyAdded(items).map((r) => r.uid),
    ["has-date", "no-date"]
  );
});

test("sortByRecentlyAdded does not mutate the input array", () => {
  const items = [
    { uid: "a", addedAt: "2026-01-01T00:00:00.000Z" },
    { uid: "b", addedAt: "2026-02-01T00:00:00.000Z" },
  ];
  const original = items.slice();
  sortByRecentlyAdded(items);
  assert.deepEqual(items, original);
});
