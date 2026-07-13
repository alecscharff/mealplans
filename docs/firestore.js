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
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

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
  await setDoc(doc(db, "settings", "main"), settings, { merge: true });
}

export async function getRecipeCache(db) {
  const snap = await getDoc(doc(db, "recipeCache", "main"));
  if (!snap.exists()) {
    return { recipes: [], lastSynced: null };
  }
  return snap.data();
}

// Applies { [uid]: weekKey } lastCooked updates to the cached recipes array.
// recipeCache is otherwise Cloud-Function-owned (full resync), but this narrow
// update is allowed from the client — see firestore.rules for the rationale.
export async function updateRecipeLastCooked(db, lastCookedUpdates) {
  if (Object.keys(lastCookedUpdates).length === 0) return;
  const cache = await getRecipeCache(db);
  const updatedRecipes = cache.recipes.map((r) =>
    lastCookedUpdates[r.uid] ? { ...r, lastCooked: lastCookedUpdates[r.uid] } : r
  );
  await setDoc(doc(db, "recipeCache", "main"), { ...cache, recipes: updatedRecipes }, { merge: true });
}

export async function getWeekState(db, weekKey) {
  const snap = await getDoc(doc(db, "weekState", weekKey));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function saveWeekState(db, weekKey, data) {
  await setDoc(doc(db, "weekState", weekKey), data, { merge: true });
}

export async function getAllWeekStates(db) {
  const snap = await getDocs(collection(db, "weekState"));
  return snap.docs.map((d) => ({ weekKey: d.id, ...d.data() }));
}

export async function markWeekArchived(db, weekKey) {
  await setDoc(doc(db, "weekState", weekKey), { archived: true }, { merge: true });
}

export async function appendHistory(db, entry) {
  await setDoc(doc(db, "history", entry.weekKey), entry, { merge: true });
}
