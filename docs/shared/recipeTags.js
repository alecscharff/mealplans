// Derives lightweight display tags from a recipe's own name/ingredients/cook time.
// HelloFresh's page metadata doesn't publish a clean protein or cooking-style
// taxonomy (recipeCategory is just "main course", recipeCuisine is regional, not
// dietary) — these are inferred, best-effort, not authoritative.

const MEAT_TAGS = [
  { tag: "Turkey", keywords: ["turkey"] },
  { tag: "Chicken", keywords: ["chicken"] },
  { tag: "Beef", keywords: ["beef", "steak", "sirloin"] },
  { tag: "Pork", keywords: ["pork", "bacon", "sausage", "ham"] },
  { tag: "Seafood", keywords: ["shrimp", "salmon", "fish", "tuna", "cod", "scallop"] },
];

// Every possible deriveProteinTag() result, for building filter dropdowns — kept in
// sync with MEAT_TAGS by construction rather than hand-duplicated.
export const PROTEIN_TAG_OPTIONS = [...MEAT_TAGS.map(({ tag }) => tag), "Vegetarian"];

// No meat keyword anywhere in the name/ingredients is treated as Vegetarian —
// a reasonable default for a recipe pool that's otherwise chicken/turkey/veg.
export function deriveProteinTag(recipe) {
  if (recipe.proteinTag && PROTEIN_TAG_OPTIONS.includes(recipe.proteinTag)) return recipe.proteinTag;
  const ingredients = (recipe.ingredientsRaw || "").split(/\n/).filter((line) => !/\b(optional|substitute|substitution|or use|instead)\b/i.test(line)).filter((line) => !/\b(broth|stock)\b/i.test(line)).join(" ");
  const haystack = `${recipe.name} ${ingredients}`.toLowerCase();
  const title = (recipe.name || "").toLowerCase();
  for (const { tag, keywords } of MEAT_TAGS) {
    if (keywords.some((kw) => title.includes(kw))) return tag;
  }
  for (const { tag, keywords } of MEAT_TAGS) if (keywords.some((kw) => haystack.includes(kw))) return tag;
  return "Vegetarian";
}

const STYLE_TAGS = [
  { tag: "One-Pot", test: (r) => /one[- ]pot|one[- ]pan|sheet[- ]pan|skillet/i.test(r.name) },
  {
    tag: "Easy Prep",
    test: (r) => /\b(simple|easy)\b/i.test(r.name) || (r.totalTimeMinutes != null && r.totalTimeMinutes <= 30),
  },
];

export function deriveStyleTags(recipe) {
  return STYLE_TAGS.filter(({ test }) => test(recipe)).map(({ tag }) => tag);
}

export function deriveTags(recipe) {
  return [deriveProteinTag(recipe), ...deriveStyleTags(recipe)];
}
