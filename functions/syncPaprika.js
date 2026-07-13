import { parseIngredientsRaw } from "../docs/shared/ingredientParser.js";
import { paprikaClient } from "./paprikaClient.js";

// Pulls recipes from Paprika, filters to the configured category, parses ingredients
// once here (not on every render), and writes the result into recipeCache/main.
// Preserves each recipe's existing lastCooked date across resyncs — the frontend
// is the source of truth for lastCooked (see docs/app.js rollover handling).
export async function runSync({ email, password, categoryId, db }) {
  const existingSnap = await db.doc("recipeCache/main").get();
  const existingLastCooked = {};
  if (existingSnap.exists) {
    for (const r of existingSnap.data().recipes || []) {
      if (r.lastCooked) existingLastCooked[r.uid] = r.lastCooked;
    }
  }

  const token = await paprikaClient.login(email, password);
  const stubs = await paprikaClient.listRecipeStubs(token);

  const recipes = [];
  for (const stub of stubs) {
    const detail = await paprikaClient.getRecipeDetail(token, stub.uid);
    if (categoryId && !(detail.categories || []).includes(categoryId)) continue;

    recipes.push({
      uid: detail.uid,
      name: detail.name,
      ingredientsRaw: detail.ingredients || "",
      ingredientsParsed: parseIngredientsRaw(detail.ingredients || ""),
      categories: detail.categories || [],
      lastCooked: existingLastCooked[detail.uid] || null,
    });
  }

  await db.doc("recipeCache/main").set({
    recipes,
    lastSynced: new Date().toISOString(),
  });

  return { count: recipes.length };
}
