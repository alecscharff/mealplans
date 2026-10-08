import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { canonicalRecipeUrl } from "./shared/canonicalUrl.js";

let dbInstance = null;

export async function initFirebase() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await signInAnonymously(auth);
  dbInstance = getFirestore(app);
  return dbInstance;
}

export async function getSettings(db) {
  const snap = await getDoc(doc(db, "settings", "main"));
  if (!snap.exists()) {
    throw new Error("settings/main doc does not exist — seed it first (see README).");
  }
  return snap.data();
}

export async function saveSettings(db, settings) {
  if (!Number.isInteger(settings.familySize) || settings.familySize < 1) {
    throw new Error("Family size must be a whole number of at least 1.");
  }
  const ref = doc(db, "settings", "main");
  await runTransaction(db, async (tx) => {
    await tx.get(ref);
    tx.set(ref, settings, { merge: true });
  });
}

export async function getRecipeCache(db) {
  const snap = await getDoc(doc(db, "recipeCache", "main"));
  if (!snap.exists()) {
    return { recipes: [] };
  }
  return snap.data();
}

// Appends one recipe (already scraped + previewed by the client) to the cache.
// recipeCache/main is seeded once at project setup, so this is always an update to an
// existing doc, never a create — see firestore.rules for why that distinction matters.
export async function addRecipe(db, recipe) {
  const ref = doc(db, "recipeCache", "main");
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const recipes = snap.exists() ? (snap.data().recipes || []) : [];
    const sourceIdentity = canonicalRecipeUrl(recipe.sourceUrl);
    if (recipes.some((r) => r.uid === recipe.uid || (sourceIdentity && canonicalRecipeUrl(r.sourceUrl) === sourceIdentity))) {
      throw new Error("This recipe was added elsewhere. Reopen Recipes to review the saved version.");
    }
    tx.set(ref, { recipes: [...recipes, recipe] }, { merge: true });
  });
}

// Replaces one recipe's fields in place, keeping its uid/lastCooked/addedAt.
export async function updateRecipe(db, uid, updates) {
  const ref = doc(db, "recipeCache", "main");
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Recipe library is missing.");
    if (!(snap.data().recipes || []).some((r) => r.uid === uid)) {
      throw new Error("This recipe was removed elsewhere. Your edits have not been saved.");
    }
    const recipes = (snap.data().recipes || []).map((r) => (r.uid === uid ? { ...r, ...updates } : r));
    tx.set(ref, { recipes }, { merge: true });
  });
}

export async function deleteRecipe(db, uid) {
  const ref = doc(db, "recipeCache", "main");
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const recipes = (snap.data()?.recipes || []).filter((r) => r.uid !== uid);
    tx.set(ref, { recipes }, { merge: true });
  });
}

// Applies { [uid]: weekKey } lastCooked updates to the cached recipes array.
export async function updateRecipeLastCooked(db, lastCookedUpdates) {
  if (Object.keys(lastCookedUpdates).length === 0) return;
  const ref = doc(db, "recipeCache", "main");
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Recipe library is missing.");
    const recipes = snap.data().recipes.map((r) =>
      lastCookedUpdates[r.uid] && (!r.lastCooked || lastCookedUpdates[r.uid] > r.lastCooked)
        ? { ...r, lastCooked: lastCookedUpdates[r.uid] } : r
    );
    tx.set(ref, { recipes }, { merge: true });
  });
}

export async function getWeekState(db, weekKey) {
  const snap = await getDoc(doc(db, "weekState", weekKey));
  if (!snap.exists()) return null;
  return snap.data();
}

// Stamps every write with when it happened, so callers that hold picks/candidates in
// memory across an async gap (the Menu tab's Save/Shuffle) can detect that another tab
// or device saved over this week in the meantime — see menu.js's staleness guard.
function nextUpdatedAt(previous) {
  // A strictly increasing stamp also detects two saves in the same millisecond.
  return new Date(Math.max(Date.now(), (Date.parse(previous) || 0) + 1)).toISOString();
}

export async function saveWeekState(db, weekKey, data, expectedUpdatedAt = undefined) {
  const ref = doc(db, "weekState", weekKey);
  let updatedAt;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const latest = snap.exists() ? snap.data() : {};
    if (expectedUpdatedAt !== undefined && (latest.updatedAt || null) !== expectedUpdatedAt) {
      const error = new Error("This week changed elsewhere. Reload the page to review the latest picks before saving.");
      error.code = "week-conflict";
      throw error;
    }
    updatedAt = nextUpdatedAt(latest.updatedAt);
    tx.set(ref, { ...data, updatedAt }, { merge: true });
  });
  return updatedAt;
}

export async function updateWeekCheck(db, weekKey, type, key, value, recipeUid = null) {
  const ref = doc(db, "weekState", weekKey);
  let updatedAt;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const state = snap.exists() ? snap.data() : {};
    updatedAt = nextUpdatedAt(state.updatedAt);
    if (type === "grocery") {
      tx.set(ref, { groceryChecks: { ...(state.groceryChecks || {}), [key]: value }, updatedAt }, { merge: true });
      return;
    }
    const stepChecks = { ...(state.stepChecks || {}) };
    stepChecks[recipeUid] = { ...(stepChecks[recipeUid] || {}), [key]: value };
    tx.set(ref, { stepChecks, updatedAt }, { merge: true });
  });
  return updatedAt;
}

export async function getAllWeekStates(db) {
  const snap = await getDocs(collection(db, "weekState"));
  return snap.docs.map((d) => ({ weekKey: d.id, ...d.data() }));
}

export async function markWeekArchived(db, weekKey) {
  await setDoc(doc(db, "weekState", weekKey), { archived: true }, { merge: true });
}

// One-time migration for the Monday->Sunday week-anchor change (see shared/weekKey.js).
// A week saved before that change lives under its old Monday key, exactly 1 day after
// its new Sunday key. If that new key has no doc yet, move the old doc's data over so
// in-progress picks/candidates/grocery-checks aren't orphaned, then remove the old doc.
// No-op once migrated (or if the week was created after the anchor change).
export async function migrateLegacyWeekKey(db, newWeekKey, legacyWeekKey) {
  const newSnap = await getDoc(doc(db, "weekState", newWeekKey));
  if (newSnap.exists()) return;
  const legacyRef = doc(db, "weekState", legacyWeekKey);
  const legacySnap = await getDoc(legacyRef);
  if (!legacySnap.exists() || legacySnap.data().archived) return;
  await setDoc(doc(db, "weekState", newWeekKey), legacySnap.data());
  await deleteDoc(legacyRef);
}

export async function appendHistory(db, entry) {
  const ref = doc(db, "history", entry.weekKey);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) tx.set(ref, entry);
  });
}

// Every past week that had picks when it rolled over (see shared/rollover.js), newest
// first — weekKey is a Sunday-of-week YYYY-MM-DD string, so lexicographic comparison
// matches chronological order (same trick used throughout this codebase).
export async function getHistory(db) {
  const snap = await getDocs(collection(db, "history"));
  return snap.docs
    .map((d) => ({ weekKey: d.id, ...d.data() }))
    .sort((a, b) => (a.weekKey < b.weekKey ? 1 : -1));
}
