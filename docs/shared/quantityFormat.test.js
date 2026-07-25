import test from "node:test";
import assert from "node:assert/strict";
import { formatQuantityLine, formatQuantityParts } from "./quantityFormat.js";

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

test("formatQuantityParts splits the same output into a prefix + bare name", () => {
  assert.deepEqual(formatQuantityParts("Garlic", 2, "clove"), { prefix: "2 cloves ", name: "Garlic" });
  assert.deepEqual(formatQuantityParts("Onion", 2, "unit"), { prefix: "2 ", name: "Onion" });
});

test("formatQuantityLine and formatQuantityParts agree", () => {
  assert.equal(formatQuantityLine("flour", 1.5, "cup"), "1.5 cup flour");
  const { prefix, name } = formatQuantityParts("flour", 1.5, "cup");
  assert.equal(`${prefix}${name}`, "1.5 cup flour");
});
