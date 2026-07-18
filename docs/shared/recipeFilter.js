// Pure filtering logic shared by the "Recipes in rotation" list (Add Recipe tab) and
// the "pick from all recipes" picker (Menu tab) — search by name, narrow by protein
// tag, and/or cap by cook time.

import { deriveProteinTag } from "./recipeTags.js";

// Shared "max cook time" options for the filter dropdowns on the Add Recipe list and
// the Menu tab's "pick from all recipes" picker.
export const TIME_FILTER_OPTIONS = [30, 45, 60];

export function filterRecipes(recipes, { query = "", protein = "", maxMinutes = null } = {}) {
  const q = query.trim().toLowerCase();
  return recipes.filter((recipe) => {
    if (q && !recipe.name.toLowerCase().includes(q)) return false;
    if (protein && deriveProteinTag(recipe) !== protein) return false;
    if (maxMinutes != null && recipe.totalTimeMinutes != null && recipe.totalTimeMinutes > maxMinutes) {
      return false;
    }
    return true;
  });
}

// A recipe is eligible for automatic candidate generation (shuffle / weekly
// suggestions) unless it's been explicitly marked skipped — still fully visible
// and pickable everywhere else (Add Recipe list, the all-recipes picker).
export function isActiveForSuggestions(recipe) {
  return !recipe.skipped;
}
