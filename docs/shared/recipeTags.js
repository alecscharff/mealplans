// Derives lightweight display tags from a recipe's own name/ingredients/cook time.
// HelloFresh's page metadata doesn't publish a clean protein or cooking-style
// taxonomy (recipeCategory is just "main course", recipeCuisine is regional, not
// dietary) — these are inferred, best-effort, not authoritative.

const MEAT_TAGS = [
  { tag: "Turkey", keywords: ["turkey"] },
  { tag: "Chicken", keywords: ["chicken"] },
  { tag: "Beef", keywords: ["beef", "steak"] },
  { tag: "Pork", keywords: ["pork", "bacon", "sausage", "ham"] },
  { tag: "Seafood", keywords: ["shrimp", "salmon", "fish", "tuna", "cod", "scallop"] },
];

// No meat keyword anywhere in the name/ingredients is treated as Vegetarian —
// a reasonable default for a recipe pool that's otherwise chicken/turkey/veg.
export function deriveProteinTag(recipe) {
  const haystack = `${recipe.name} ${recipe.ingredientsRaw || ""}`.toLowerCase();
  for (const { tag, keywords } of MEAT_TAGS) {
    if (keywords.some((kw) => haystack.includes(kw))) return tag;
  }
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
