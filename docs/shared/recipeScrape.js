// Extracts a recipe from a page's schema.org Recipe JSON-LD — the structured data most
// recipe sites embed specifically so Google/Pinterest can show rich results. This is
// public metadata meant to be machine-read, unlike Paprika's sync API which requires
// impersonating their official app.
//
// No HTML/DOM parser dependency: JSON-LD blocks are self-contained <script> tags, so a
// narrow regex to locate them (not to parse HTML generally) is enough.

import { parseIngredientsRaw } from "./ingredientParser.js";

const HTML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

function stripHtml(str) {
  return String(str)
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#39|#\d+|[a-z]+);/gi, (m, ent) => HTML_ENTITIES[ent.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

export function extractJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // Malformed JSON-LD on the page — skip this block, keep looking.
    }
  }
  return blocks;
}

function isRecipeType(type) {
  if (!type) return false;
  return Array.isArray(type) ? type.includes("Recipe") : type === "Recipe";
}

// Depth-first search through a parsed JSON-LD node (object, array, or @graph wrapper)
// for the first object whose @type is "Recipe".
export function findRecipe(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipe(item);
      if (found) return found;
    }
    return null;
  }
  if (isRecipeType(node["@type"])) return node;
  if (Array.isArray(node["@graph"])) return findRecipe(node["@graph"]);
  return null;
}

function flattenInstructions(node) {
  if (!node) return [];
  if (typeof node === "string") {
    return node
      .split(/\r?\n+/)
      .map((line) => stripHtml(line))
      .filter((line) => line.length > 0);
  }
  if (Array.isArray(node)) {
    return node.flatMap(flattenInstructions);
  }
  if (typeof node === "object") {
    if (Array.isArray(node.itemListElement)) return flattenInstructions(node.itemListElement);
    if (node.text) return [stripHtml(node.text)];
    if (node.name) return [stripHtml(node.name)];
  }
  return [];
}

export function normalizeInstructions(recipeInstructions) {
  return flattenInstructions(recipeInstructions);
}

// schema.org allows `image` to be a URL string, an array of those, an ImageObject
// ({ url: "..." }), or an array of ImageObjects — take the first usable URL.
export function normalizeImage(image) {
  const candidates = Array.isArray(image) ? image : [image];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "string") return candidate;
    if (typeof candidate === "object" && typeof candidate.url === "string") return candidate.url;
  }
  return null;
}

export function normalizeYield(recipeYield) {
  const candidates = Array.isArray(recipeYield) ? recipeYield : [recipeYield];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const match = String(candidate).match(/\d+/);
    if (match) return parseInt(match[0], 10);
  }
  return null;
}

export function scrapeRecipeFromHtml(html, sourceUrl) {
  const blocks = extractJsonLd(html);
  let recipe = null;
  for (const block of blocks) {
    recipe = findRecipe(block);
    if (recipe) break;
  }
  if (!recipe) return null;

  const ingredientLines = (recipe.recipeIngredient || recipe.ingredients || []).map((line) =>
    stripHtml(line)
  );
  const ingredientsRaw = ingredientLines.join("\n");

  return {
    name: recipe.name ? stripHtml(recipe.name) : "Untitled recipe",
    sourceUrl,
    servings: normalizeYield(recipe.recipeYield),
    image: normalizeImage(recipe.image),
    ingredientsRaw,
    ingredientsParsed: parseIngredientsRaw(ingredientsRaw),
    directions: normalizeInstructions(recipe.recipeInstructions),
  };
}
