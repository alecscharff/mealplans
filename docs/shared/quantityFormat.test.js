import test from "node:test";
import assert from "node:assert/strict";
import { formatQuantityLine } from "./quantityFormat.js";

test("omits the 'unit' placeholder from display", () => {
  assert.equal(formatQuantityLine("Onion", 2, "unit"), "2 Onion");
});

test("omits the unit entirely when there is none", () => {
  assert.equal(formatQuantityLine("Onion", 2, null), "2 Onion");
});

test("keeps an abbreviated unit unpluralized", () => {
  assert.equal(formatQuantityLine("flour", 2, "cup"), "2 cup flour");
});

test("pluralizes a full-word unit when quantity isn't 1", () => {
  assert.equal(formatQuantityLine("Garlic", 2, "clove"), "2 cloves Garlic");
  assert.equal(formatQuantityLine("Chickpeas", 3, "can"), "3 cans Chickpeas");
});

test("keeps a full-word unit singular when quantity is 1", () => {
  assert.equal(formatQuantityLine("Garlic", 1, "clove"), "1 clove Garlic");
  assert.equal(formatQuantityLine("Chickpeas", 1, "can"), "1 can Chickpeas");
});
