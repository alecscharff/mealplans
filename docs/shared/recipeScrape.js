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

// Converts <strong>/<b> spans to **word** markers (parsed into real <strong>
// elements at render time — see docs/views/boldText.js) and strips every other tag.
// Never passes raw HTML through: only this narrow, non-HTML marker syntax survives,
// so there's no injection surface even though the source is a third-party page.
function htmlToBoldMarkedText(html) {
  const withMarkers = String(html).replace(
    /<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi,
    (_m, _tag, inner) => `**${inner}**`
  );
  return stripHtml(withMarkers);
}

// A single HowToStep's text sometimes contains its own <ul><li> sub-steps (e.g. one
// HelloFresh "step" bundling 2-3 discrete actions) — split those into separate steps
// instead of flattening them into one run-on line. Falls back to the whole text as
// one step when there's no <li> structure.
function splitStepBullets(html) {
  const items = [];
  const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = liRe.exec(html))) {
    const text = htmlToBoldMarkedText(match[1]);
    if (text) items.push(text);
  }
  if (items.length > 0) return items;
  const whole = htmlToBoldMarkedText(html);
  return whole ? [whole] : [];
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
      .flatMap((line) => splitStepBullets(line))
      .filter((line) => line.length > 0);
  }
  if (Array.isArray(node)) {
    return node.flatMap(flattenInstructions);
  }
  if (typeof node === "object") {
    if (Array.isArray(node.itemListElement)) return flattenInstructions(node.itemListElement);
    if (node.text) return splitStepBullets(node.text);
    if (node.name) return [htmlToBoldMarkedText(node.name)];
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

// Parses an ISO 8601 duration like "PT35M" or "PT1H10M" into whole minutes.
export function parseDurationMinutes(duration) {
  if (!duration || typeof duration !== "string") return null;
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
  if (!match) return null;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  if (hours === 0 && minutes === 0 && !match[1] && !match[2]) return null;
  return hours * 60 + minutes;
}

// Prefers totalTime; falls back to summing prepTime + cookTime when a page only
// publishes those separately.
export function normalizeTotalTimeMinutes(recipe) {
  const total = parseDurationMinutes(recipe.totalTime);
  if (total != null) return total;
  const prep = parseDurationMinutes(recipe.prepTime) || 0;
  const cook = parseDurationMinutes(recipe.cookTime) || 0;
  return prep + cook > 0 ? prep + cook : null;
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
    totalTimeMinutes: normalizeTotalTimeMinutes(recipe),
    ingredientsRaw,
    ingredientsParsed: parseIngredientsRaw(ingredientsRaw),
    directions: normalizeInstructions(recipe.recipeInstructions),
  };
}
