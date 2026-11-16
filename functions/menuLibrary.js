import { createHash, randomBytes, randomUUID } from "node:crypto";
import { canonicalRecipeUrl } from "./shared/canonicalUrl.js";
import { recipeName } from "./shared/menuEmail.js";
import { addWeeks } from "./shared/weekKey.js";
import { visiblePicks } from "./geminiMenu.js";

const fingerprint = (recipe) => createHash("sha256").update(JSON.stringify(recipe)).digest("hex");

export function deleteImpact(weeks, uid) {
  return weeks.filter((snapshot) => visiblePicks(snapshot.data()).includes(uid)).map(({ id }) => id);
}

export async function handleRecipeDeletion({ action, tx, db, cache, threadRef, start }) {
  const recipes = cache.data()?.recipes || [];
  const pendingRef = threadRef.collection("pending").doc("recipeDelete");
  const pending = action.type === "confirmDelete" ? (await tx.get(pendingRef)).data() : null;
  if (action.type === "confirmDelete" && (!pending || pending.code !== action.code || pending.expiresAt <= Date.now())) {
    return "That deletion confirmation is invalid or expired. Send a fresh delete request.";
  }
  const matches = action.type === "requestDelete"
    ? recipes.filter((recipe) => action.uid ? recipe.uid === action.uid : recipeName(recipe.name) === action.name)
    : recipes.filter((recipe) => recipe.uid === pending.uid);
  if (matches.length !== 1) {
    return matches.length ? "More than one recipe has that name. Open Sunday Menu to choose which to delete."
      : "I couldn't find that recipe. Check its full name in Sunday Menu.";
  }
  const [recipe] = matches;
  const refs = Array.from({ length: 4 }, (_, index) => db.doc(`weekState/${addWeeks(start, index)}`));
  const weeks = (await tx.getAll(...refs)).filter((snapshot) => snapshot.exists && !snapshot.data().archived);
  const affected = deleteImpact(weeks, recipe.uid);
  const impact = affected.length ? ` This also removes it from meals shown for ${affected.join(", ")}.` : "";
  if (!pending) {
    const code = randomBytes(6).toString("hex");
    tx.set(pendingRef, { code, uid: recipe.uid, fingerprint: fingerprint(recipe), affected, expiresAt: Date.now() + 86400000 });
    return `Delete “${recipe.name}” from the recipe library?${impact} Reply CONFIRM DELETE ${code} within 24 hours.`;
  }
  if (pending.fingerprint !== fingerprint(recipe) || pending.affected.join(",") !== affected.join(",")) {
    tx.delete(pendingRef);
    return "That recipe or its scheduled meals changed. Send a fresh delete request to review the current impact.";
  }
  tx.update(cache.ref, { recipes: recipes.filter(({ uid }) => uid !== recipe.uid) });
  for (const snapshot of weeks) {
    const state = snapshot.data();
    if (![...(state.picks || []), ...(state.candidates || [])].includes(recipe.uid)) continue;
    const picks = (state.picks || []).filter((uid) => uid !== recipe.uid);
    const candidates = (state.candidates || []).filter((uid) => uid !== recipe.uid);
    const updatedAt = new Date(Math.max(Date.now(), (Date.parse(state.updatedAt) || 0) + 1)).toISOString();
    tx.update(snapshot.ref, { picks, candidates, updatedAt });
  }
  tx.delete(pendingRef);
  return `Deleted “${recipe.name}” from the recipe library.${impact}`;
}

export function saveImportedRecipe(tx, cache, recipe) {
  if (!cache.exists) return "The recipe library is unavailable. Try again from Sunday Menu.";
  const recipes = cache.data()?.recipes || [];
  const identity = canonicalRecipeUrl(recipe.sourceUrl);
  const existing = recipes.find(({ sourceUrl }) => identity && canonicalRecipeUrl(sourceUrl) === identity);
  if (existing) return `“${existing.name}” is already in the recipe library.`;
  tx.update(cache.ref, {
    recipes: [...recipes, { ...recipe, uid: randomUUID(), lastCooked: null, addedAt: new Date().toISOString() }],
  });
  return `Added “${recipe.name}” to the recipe library.`;
}
