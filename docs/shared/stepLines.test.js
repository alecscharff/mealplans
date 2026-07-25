import test from "node:test";
import assert from "node:assert/strict";
import { splitStepIntoLines } from "./stepLines.js";

test("splits a step with two sentences into two lines", () => {
  assert.deepEqual(
    splitStepIntoLines("Preheat the oven to 425°F. Dice the **onion** and mince the **garlic**."),
    ["Preheat the oven to 425°F.", "Dice the **onion** and mince the **garlic**."]
  );
});

test("splits on ! and ? boundaries too", () => {
  assert.deepEqual(splitStepIntoLines("Watch out, it's hot! Serve immediately."), [
    "Watch out, it's hot!",
    "Serve immediately.",
  ]);
});

test("leaves a single-sentence step alone", () => {
  const step = "Heat a large skillet over medium-high heat and brown the **ground beef**, 4-5 minutes.";
  assert.deepEqual(splitStepIntoLines(step), [step]);
});

test("does not split on an abbreviation followed by a lowercase word", () => {
  assert.deepEqual(splitStepIntoLines("Add 1 tbsp. olive oil and stir to combine."), [
    "Add 1 tbsp. olive oil and stir to combine.",
  ]);
});

test("does not split on a decimal number", () => {
  assert.deepEqual(splitStepIntoLines("Add 1.5 cups of stock and simmer."), [
    "Add 1.5 cups of stock and simmer.",
  ]);
});

test("splits when the next sentence starts with a bold marker", () => {
  assert.deepEqual(splitStepIntoLines("Add the **Parmesan cheese**. **Serve** immediately."), [
    "Add the **Parmesan cheese**.",
    "**Serve** immediately.",
  ]);
});

test("handles three or more sentences", () => {
  assert.deepEqual(
    splitStepIntoLines("Boil the pasta. Drain it well. Toss with the sauce and serve."),
    ["Boil the pasta.", "Drain it well.", "Toss with the sauce and serve."]
  );
});

test("trims surrounding whitespace and drops empty results", () => {
  assert.deepEqual(splitStepIntoLines("  Rest the meat for 5 minutes.  "), ["Rest the meat for 5 minutes."]);
});
