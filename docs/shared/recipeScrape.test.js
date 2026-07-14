import test from "node:test";
import assert from "node:assert/strict";
import {
  extractJsonLd,
  findRecipe,
  normalizeImage,
  normalizeInstructions,
  normalizeYield,
  parseDurationMinutes,
  normalizeTotalTimeMinutes,
  scrapeRecipeFromHtml,
} from "./recipeScrape.js";

function htmlWithJsonLd(obj) {
  return `<html><head><script type="application/ld+json">${JSON.stringify(obj)}</script></head><body></body></html>`;
}

test("extractJsonLd parses a single script block", () => {
  const html = htmlWithJsonLd({ "@type": "Recipe", name: "Soup" });
  const blocks = extractJsonLd(html);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].name, "Soup");
});

test("extractJsonLd skips malformed blocks and keeps valid ones", () => {
  const html = `
    <script type="application/ld+json">{not valid json}</script>
    <script type="application/ld+json">{"@type": "Recipe", "name": "Stew"}</script>
  `;
  const blocks = extractJsonLd(html);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].name, "Stew");
});

test("findRecipe locates a top-level Recipe object", () => {
  const node = { "@type": "Recipe", name: "Chili" };
  assert.equal(findRecipe(node).name, "Chili");
});

test("findRecipe searches inside @graph arrays", () => {
  const node = {
    "@graph": [
      { "@type": "WebSite", name: "Some Blog" },
      { "@type": "Recipe", name: "Tacos" },
    ],
  };
  assert.equal(findRecipe(node).name, "Tacos");
});

test("findRecipe handles @type as an array", () => {
  const node = { "@type": ["Recipe", "NewsArticle"], name: "Curry" };
  assert.equal(findRecipe(node).name, "Curry");
});

test("findRecipe returns null when nothing matches", () => {
  assert.equal(findRecipe({ "@type": "WebSite" }), null);
  assert.equal(findRecipe(null), null);
});

test("normalizeYield extracts a number from a plain string", () => {
  assert.equal(normalizeYield("4 servings"), 4);
});

test("normalizeYield extracts a number from an array of candidates", () => {
  assert.equal(normalizeYield(["4 servings", "4"]), 4);
});

test("normalizeYield handles a bare number", () => {
  assert.equal(normalizeYield(6), 6);
});

test("normalizeYield returns null when nothing parses", () => {
  assert.equal(normalizeYield(null), null);
  assert.equal(normalizeYield("Serves a crowd"), null);
});

test("parseDurationMinutes handles minutes-only durations", () => {
  assert.equal(parseDurationMinutes("PT35M"), 35);
});

test("parseDurationMinutes handles hours and minutes", () => {
  assert.equal(parseDurationMinutes("PT1H10M"), 70);
});

test("parseDurationMinutes handles hours-only durations", () => {
  assert.equal(parseDurationMinutes("PT2H"), 120);
});

test("parseDurationMinutes returns null for invalid or missing input", () => {
  assert.equal(parseDurationMinutes(null), null);
  assert.equal(parseDurationMinutes(""), null);
  assert.equal(parseDurationMinutes("35 minutes"), null);
});

test("normalizeTotalTimeMinutes prefers totalTime", () => {
  assert.equal(normalizeTotalTimeMinutes({ totalTime: "PT40M", prepTime: "PT10M", cookTime: "PT20M" }), 40);
});

test("normalizeTotalTimeMinutes falls back to prepTime + cookTime", () => {
  assert.equal(normalizeTotalTimeMinutes({ prepTime: "PT10M", cookTime: "PT20M" }), 30);
});

test("normalizeTotalTimeMinutes returns null when nothing is available", () => {
  assert.equal(normalizeTotalTimeMinutes({}), null);
});

test("normalizeImage handles a plain string URL", () => {
  assert.equal(normalizeImage("https://example.com/photo.jpg"), "https://example.com/photo.jpg");
});

test("normalizeImage handles an array of string URLs, taking the first", () => {
  assert.equal(
    normalizeImage(["https://example.com/a.jpg", "https://example.com/b.jpg"]),
    "https://example.com/a.jpg"
  );
});

test("normalizeImage handles an ImageObject", () => {
  assert.equal(normalizeImage({ "@type": "ImageObject", url: "https://example.com/c.jpg" }), "https://example.com/c.jpg");
});

test("normalizeImage handles an array of ImageObjects", () => {
  assert.equal(
    normalizeImage([{ "@type": "ImageObject", url: "https://example.com/d.jpg" }]),
    "https://example.com/d.jpg"
  );
});

test("normalizeImage returns null when nothing usable is present", () => {
  assert.equal(normalizeImage(null), null);
  assert.equal(normalizeImage([{ "@type": "ImageObject" }]), null);
});

test("normalizeInstructions handles an array of plain strings", () => {
  assert.deepEqual(normalizeInstructions(["Preheat oven.", "Bake for 20 minutes."]), [
    "Preheat oven.",
    "Bake for 20 minutes.",
  ]);
});

test("normalizeInstructions handles HowToStep objects", () => {
  const steps = [
    { "@type": "HowToStep", text: "Chop onions." },
    { "@type": "HowToStep", text: "Saute until golden." },
  ];
  assert.deepEqual(normalizeInstructions(steps), ["Chop onions.", "Saute until golden."]);
});

test("normalizeInstructions flattens HowToSection groups", () => {
  const sections = [
    {
      "@type": "HowToSection",
      name: "For the sauce",
      itemListElement: [
        { "@type": "HowToStep", text: "Mix tomatoes and garlic." },
        { "@type": "HowToStep", text: "Simmer 10 minutes." },
      ],
    },
    {
      "@type": "HowToSection",
      name: "For the pasta",
      itemListElement: [{ "@type": "HowToStep", text: "Boil pasta." }],
    },
  ];
  assert.deepEqual(normalizeInstructions(sections), [
    "Mix tomatoes and garlic.",
    "Simmer 10 minutes.",
    "Boil pasta.",
  ]);
});

test("normalizeInstructions splits a single newline-separated string", () => {
  assert.deepEqual(normalizeInstructions("Step one.\nStep two.\n\nStep three."), [
    "Step one.",
    "Step two.",
    "Step three.",
  ]);
});

test("normalizeInstructions strips embedded HTML tags", () => {
  assert.deepEqual(normalizeInstructions([{ text: "<p>Preheat the oven to 400&deg;F.</p>" }]), [
    "Preheat the oven to 400&deg;F.",
  ]);
});

test("normalizeInstructions splits a <ul><li> step into separate discrete steps", () => {
  const step = {
    "@type": "HowToStep",
    text: "<ul><li><p>Adjust rack and preheat oven to 425 degrees.</p></li><li><p>Dice potatoes into 1-inch pieces.</p></li></ul>",
  };
  assert.deepEqual(normalizeInstructions([step]), [
    "Adjust rack and preheat oven to 425 degrees.",
    "Dice potatoes into 1-inch pieces.",
  ]);
});

test("normalizeInstructions preserves <strong> ingredient mentions as **bold** markers", () => {
  const step = { "@type": "HowToStep", text: "Season the <strong>chicken</strong> with <strong>salt</strong>." };
  assert.deepEqual(normalizeInstructions([step]), ["Season the **chicken** with **salt**."]);
});

test("normalizeInstructions combines bullet-splitting and bold marking together", () => {
  const step = {
    "@type": "HowToStep",
    text: "<ul><li>Pat <strong>chicken</strong> dry.</li><li>Season with <strong>salt</strong> and <strong>pepper</strong>.</li></ul>",
  };
  assert.deepEqual(normalizeInstructions([step]), [
    "Pat **chicken** dry.",
    "Season with **salt** and **pepper**.",
  ]);
});

test("scrapeRecipeFromHtml returns a full structured recipe", () => {
  const html = htmlWithJsonLd({
    "@type": "Recipe",
    name: "Weeknight Chili",
    recipeYield: "6 servings",
    image: [{ "@type": "ImageObject", url: "https://example.com/chili.jpg" }],
    totalTime: "PT35M",
    recipeIngredient: ["2 cups flour", "1 lb ground beef", "Salt to taste"],
    recipeInstructions: [
      { "@type": "HowToStep", text: "Brown the beef." },
      { "@type": "HowToStep", text: "Add remaining ingredients and simmer." },
    ],
  });

  const recipe = scrapeRecipeFromHtml(html, "https://example.com/chili");
  assert.equal(recipe.name, "Weeknight Chili");
  assert.equal(recipe.sourceUrl, "https://example.com/chili");
  assert.equal(recipe.servings, 6);
  assert.equal(recipe.image, "https://example.com/chili.jpg");
  assert.equal(recipe.totalTimeMinutes, 35);
  assert.equal(recipe.ingredientsRaw, "2 cups flour\n1 lb ground beef\nSalt to taste");
  assert.equal(recipe.ingredientsParsed.length, 3);
  assert.equal(recipe.ingredientsParsed[0].quantity, 2);
  assert.deepEqual(recipe.directions, ["Brown the beef.", "Add remaining ingredients and simmer."]);
});

test("scrapeRecipeFromHtml returns null when no Recipe JSON-LD is present", () => {
  const html = `<html><head><script type="application/ld+json">{"@type": "WebSite"}</script></head></html>`;
  assert.equal(scrapeRecipeFromHtml(html, "https://example.com/none"), null);
});

test("scrapeRecipeFromHtml finds a Recipe nested in @graph among other blocks", () => {
  const html = `
    <html><head>
    <script type="application/ld+json">{"@type": "BreadcrumbList"}</script>
    <script type="application/ld+json">
      {"@graph": [
        {"@type": "WebSite", "name": "Blog"},
        {"@type": "Recipe", "name": "Pancakes", "recipeIngredient": ["1 cup flour"], "recipeInstructions": "Mix and cook."}
      ]}
    </script>
    </head></html>
  `;
  const recipe = scrapeRecipeFromHtml(html, "https://example.com/pancakes");
  assert.equal(recipe.name, "Pancakes");
  assert.deepEqual(recipe.directions, ["Mix and cook."]);
});
