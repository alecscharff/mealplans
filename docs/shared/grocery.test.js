import test from "node:test";
import assert from "node:assert/strict";
import { buildGroceryList, categorizeIngredient } from "./grocery.js";

test("categorizeIngredient buckets common ingredients", () => {
  assert.equal(categorizeIngredient("yellow onion"), "Produce");
  assert.equal(categorizeIngredient("chicken breast"), "Meat & Seafood");
  assert.equal(categorizeIngredient("cheddar cheese"), "Dairy & Eggs");
  assert.equal(categorizeIngredient("all-purpose flour"), "Pantry");
  assert.equal(categorizeIngredient("unobtainium"), "Other");
});

test("buildGroceryList merges the same ingredient across both recipes and scales by family size", () => {
  const recipes = [
    {
      uid: "r1",
      name: "Recipe One",
      ingredientsParsed: [
        { quantity: 1, unit: "cup", name: "flour", raw: "1 cup flour" },
        { quantity: 2, unit: null, name: "eggs", raw: "2 eggs" },
      ],
    },
    {
      uid: "r2",
      name: "Recipe Two",
      ingredientsParsed: [
        { quantity: 2, unit: "cup", name: "flour", raw: "2 cups flour" },
      ],
    },
  ];

  // familySize 8 / base 4 = scale factor 2
  const grouped = buildGroceryList(recipes, 8, 4);
  const flourItem = grouped["Pantry"].find((i) => i.name === "flour");
  assert.equal(flourItem.quantity, 6); // (1 + 2) * 2
  assert.equal(flourItem.unit, "cup");

  const eggsItem = grouped["Dairy & Eggs"].find((i) => i.name === "eggs");
  assert.equal(eggsItem.quantity, 4); // 2 * 2
});

test("buildGroceryList scales each recipe by its own servings when known", () => {
  const recipes = [
    {
      uid: "r1",
      name: "Serves 2",
      servings: 2,
      ingredientsParsed: [{ quantity: 1, unit: "cup", name: "rice", raw: "1 cup rice" }],
    },
    {
      uid: "r2",
      name: "Serves 8 (no servings data, falls back to base)",
      ingredientsParsed: [{ quantity: 1, unit: "cup", name: "beans", raw: "1 cup beans" }],
    },
  ];

  // familySize 4: recipe r1 (servings 2) scales x2, recipe r2 (no servings, base 4) scales x1.
  const grouped = buildGroceryList(recipes, 4, 4);
  assert.equal(grouped["Pantry"].find((i) => i.name === "rice").quantity, 2);
  assert.equal(grouped["Pantry"].find((i) => i.name === "beans").quantity, 1);
});

test("buildGroceryList keeps unparseable ingredient lines separate, unscaled, tagged by recipe", () => {
  const recipes = [
    {
      uid: "r1",
      name: "Recipe One",
      ingredientsParsed: [
        { quantity: null, unit: null, name: "Salt and pepper to taste", raw: "Salt and pepper to taste" },
      ],
    },
  ];
  const grouped = buildGroceryList(recipes, 4, 4);
  const items = grouped["Other (unparsed)"];
  assert.equal(items.length, 1);
  assert.equal(items[0].raw, "Salt and pepper to taste");
  assert.equal(items[0].recipeName, "Recipe One");
});
