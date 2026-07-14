// Renders a recipe's photo, or — when it has none (a source page with no image, or a
// broken/blocked image URL) — a deterministic gradient-and-initial placeholder instead
// of a broken-image icon. Shared by menu/grocery/addRecipe/recipeDetail so all four look
// the same rather than each inventing its own fallback.

const PLACEHOLDER_HUES = [18, 340, 200, 150, 28, 265];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function createPlaceholder(recipe, sizeClass) {
  const div = document.createElement("div");
  div.className = `${sizeClass} recipe-thumb-placeholder`;
  const hue = PLACEHOLDER_HUES[hashString(recipe.name || "?") % PLACEHOLDER_HUES.length];
  div.style.setProperty("--placeholder-hue", hue);
  const letter = document.createElement("span");
  letter.textContent = (recipe.name || "?").trim().charAt(0).toUpperCase();
  div.appendChild(letter);
  return div;
}

export function createRecipeThumb(recipe, sizeClass = "recipe-thumb") {
  if (!recipe.image) return createPlaceholder(recipe, sizeClass);

  const img = document.createElement("img");
  img.src = recipe.image;
  img.alt = recipe.name || "";
  img.className = sizeClass;
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.addEventListener("error", () => img.replaceWith(createPlaceholder(recipe, sizeClass)), {
    once: true,
  });
  return img;
}
