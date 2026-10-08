import test from "node:test";
import assert from "node:assert/strict";
import { canonicalRecipeUrl } from "./canonicalUrl.js";

test("normalizes hosts and removes known tracking parameters", () => {
  assert.equal(canonicalRecipeUrl("http://www.example.com/recipe/?utm_source=mail#top"), "http://example.com/recipe");
  assert.equal(canonicalRecipeUrl("https://cooking.nytimes.com/recipes/1015078-dish?art=123"), "https://cooking.nytimes.com/recipes/1015078-dish");
});

test("preserves query parameters that may identify recipe content", () => {
  assert.equal(canonicalRecipeUrl("https://example.com/recipe?servings=4"), "https://example.com/recipe?servings=4");
});
