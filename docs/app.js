import {
  initFirebase,
  getSettings,
  getRecipeCache,
  getWeekState,
  saveWeekState,
  getAllWeekStates,
  markWeekArchived,
  appendHistory,
  getHistory,
  updateRecipeLastCooked,
  migrateLegacyWeekKey,
} from "./firestore.js";
import { weekKey as computeWeekKey, addWeeks, addDays } from "./shared/weekKey.js";
import { generateCandidates } from "./shared/candidates.js";
import { computeRollover } from "./shared/rollover.js";
import { isActiveForSuggestions } from "./shared/recipeFilter.js";
import { renderMenu } from "./views/menu.js";
import { renderGrocery } from "./views/grocery.js";
import { renderHistory } from "./views/history.js";
import { renderSettings } from "./views/settings.js";
import { renderAddRecipe } from "./views/addRecipe.js";
import { renderRecipeDetail } from "./views/recipeDetail.js";
import { renderEditRecipe } from "./views/editRecipe.js";

const appEl = document.getElementById("app");
const statusEl = document.getElementById("status");

const views = {
  menu: renderMenu,
  grocery: renderGrocery,
  history: renderHistory,
  settings: renderSettings,
  addRecipe: renderAddRecipe,
  detail: renderRecipeDetail,
  editRecipe: renderEditRecipe,
};
let currentTab = "menu";
let navParams = {};
let ctx = null;
let canLeaveCurrentView = () => true;
let hasUnsavedChanges = () => false;
let archivedRecipesPromise;

// The menu view shows this week plus this many weeks ahead, each with its own 2 picks +
// 2 alternatives (candidates take count below), so a family can plan several weeks out.
const UPCOMING_WEEKS_COUNT = 4;
const CANDIDATES_PER_WEEK = 4;

function candidateSeed(settings, weekState) {
  return `${settings.shuffleSeed || "sunday-menu"}:${weekState?.shuffleNonce || 0}`;
}

// Loads (or creates) a single week's state, drawing candidates only from
// `availableRecipes` — recipes not already showing up in an earlier-processed week
// of the 4-week view, so the same recipe can't be suggested twice in one pass.
// Regenerates candidates if the available pool changed size since they were last
// picked and this week's picks aren't finalized yet. Every week (including the
// current one) works identically — there's no deadline auto-pick special case.
async function ensureWeek(db, weekKey, settings, availableRecipes) {
  let weekState = await getWeekState(db, weekKey);
  if (!weekState) {
    const candidates = generateCandidates(availableRecipes, weekKey, candidateSeed(settings, null), {
      takeCount: CANDIDATES_PER_WEEK,
    });
    weekState = {
      candidates,
      picks: [],
      groceryChecks: {},
      stepChecks: {},
      shuffleNonce: 0,
      archived: false,
    };
    await saveWeekState(db, weekKey, weekState);
  } else if (
    weekState.picks.length < 2 &&
    weekState.candidates.length !== Math.min(availableRecipes.length, CANDIDATES_PER_WEEK)
  ) {
    // Covers the available pool growing or shrinking (including a shrunk target
    // take-count left over from before CANDIDATES_PER_WEEK changed).
    const candidates = generateCandidates(availableRecipes, weekKey, candidateSeed(settings, weekState), {
      takeCount: CANDIDATES_PER_WEEK,
    });
    weekState = { ...weekState, candidates };
    await saveWeekState(db, weekKey, weekState);
  }
  return weekState;
}

async function loadState(db) {
  const settings = await getSettings(db);
  const recipeCache = await getRecipeCache(db);
  const currentWeekKey = computeWeekKey(new Date());

  // Week rollover / history archiving — runs "on load" since this app has no
  // server-side scheduler for it (see build plan's non-goals: no push/background jobs).
  const allWeekStates = await getAllWeekStates(db);
  const rollover = computeRollover(allWeekStates, currentWeekKey);
  for (const entry of rollover.historyAppends) {
    await appendHistory(db, {
      ...entry,
      recipes: entry.recipeUids.map((uid) => recipeCache.recipes.find((r) => r.uid === uid)).filter(Boolean).map(({ uid, name, sourceUrl, image, servings, totalTimeMinutes, ingredientsRaw, ingredientsParsed, directions }) => ({ uid, name, sourceUrl, image, servings, totalTimeMinutes, ingredientsRaw, ingredientsParsed, directions })),
    });
  }
  if (Object.keys(rollover.lastCookedUpdates).length > 0) {
    await updateRecipeLastCooked(db, rollover.lastCookedUpdates);
  }
  for (const wk of rollover.archivedWeekKeys) {
    await markWeekArchived(db, wk);
  }
  if (rollover.archivedWeekKeys.length > 0) {
    // Cache may be stale after lastCooked updates; reload it.
    Object.assign(recipeCache, await getRecipeCache(db));
  }

  const recipesByUid = Object.fromEntries(recipeCache.recipes.map((r) => [r.uid, r]));
  archivedRecipesPromise ??= fetch(new URL("./data/archived-recipes.json", import.meta.url)).then((response) => response.ok ? response.json() : []).catch(() => []);
  const archivedRecipes = await archivedRecipesPromise;
  const archivedRecipesByUid = Object.fromEntries(archivedRecipes.map((r) => [r.uid, r]));

  // Load (or create) this week's state, plus the next few weeks ahead for the 4-week
  // menu view. Skipped recipes are excluded from automatic candidate generation (but
  // stay fully visible/pickable everywhere else via recipesByUid) — see
  // shared/recipeFilter.js.
  const weekKeys = Array.from({ length: UPCOMING_WEEKS_COUNT }, (_, i) => addWeeks(currentWeekKey, i));
  const suggestibleRecipes = recipeCache.recipes.filter(isActiveForSuggestions);
  let weekState = null;
  const upcomingWeeks = [];
  const usedUids = new Set();
  for (const weekKey of weekKeys) {
    // One-time carry-over for the Monday->Sunday week-anchor change — see
    // firestore.js#migrateLegacyWeekKey. No-ops once every live week has migrated.
    await migrateLegacyWeekKey(db, weekKey, addDays(weekKey, 1));
    const availableRecipes = suggestibleRecipes.filter((r) => !usedUids.has(r.uid));
    const ws = await ensureWeek(db, weekKey, settings, availableRecipes);

    if (weekKey === currentWeekKey) weekState = ws;

    for (const uid of ws.candidates) usedUids.add(uid);
    upcomingWeeks.push({ weekKey, weekState: ws });
  }

  const history = await getHistory(db);

  return { db, settings, recipeCache, currentWeekKey, weekState, recipesByUid, archivedRecipesByUid, upcomingWeeks, history };
}

async function refresh() {
  ctx = await loadState(ctx.db);
  renderCurrentTab();
}

function navigate(view, params = {}) {
  if (!canLeaveCurrentView()) return;
  currentTab = view;
  syncActiveTab();
  navParams = params;
  canLeaveCurrentView = () => true;
  renderCurrentTab();
}

function renderCurrentTab() {
  appEl.innerHTML = "";
  canLeaveCurrentView = () => true;
  hasUnsavedChanges = () => false;
  views[currentTab](appEl, { ...ctx, navigate, params: navParams, setLeaveGuard: (guard, dirtyCheck = () => false) => { canLeaveCurrentView = guard; hasUnsavedChanges = dirtyCheck; } }, refresh);
}

function syncActiveTab() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    const active = button.dataset.view === currentTab;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
  });
}

window.addEventListener("beforeunload", (event) => {
  if (!hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = "";
});

function setupTabs() {
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!canLeaveCurrentView()) return;
      currentTab = btn.dataset.view;
      navParams = {};
      canLeaveCurrentView = () => true;
      syncActiveTab();
      renderCurrentTab();
    });
  });
  syncActiveTab();
}

async function main() {
  try {
    const db = await initFirebase();
    ctx = await loadState(db);
    statusEl.remove();
    setupTabs();
    renderCurrentTab();
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Failed to load: ${err.message}`;
  }
}

main();
