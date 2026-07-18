import {
  initFirebase,
  getSettings,
  getRecipeCache,
  getWeekState,
  saveWeekState,
  getAllWeekStates,
  markWeekArchived,
  appendHistory,
  updateRecipeLastCooked,
} from "./firestore.js";
import { weekKey as computeWeekKey, addWeeks } from "./shared/weekKey.js";
import { generateCandidates } from "./shared/candidates.js";
import { computeRollover } from "./shared/rollover.js";
import { isActiveForSuggestions } from "./shared/recipeFilter.js";
import { renderMenu } from "./views/menu.js";
import { renderGrocery } from "./views/grocery.js";
import { renderSettings } from "./views/settings.js";
import { renderAddRecipe } from "./views/addRecipe.js";
import { renderRecipeDetail } from "./views/recipeDetail.js";
import { renderEditRecipe } from "./views/editRecipe.js";

const appEl = document.getElementById("app");
const statusEl = document.getElementById("status");

const views = {
  menu: renderMenu,
  grocery: renderGrocery,
  settings: renderSettings,
  addRecipe: renderAddRecipe,
  detail: renderRecipeDetail,
  editRecipe: renderEditRecipe,
};
let currentTab = "menu";
let navParams = {};
let ctx = null;

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
    await appendHistory(db, entry);
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
    const availableRecipes = suggestibleRecipes.filter((r) => !usedUids.has(r.uid));
    const ws = await ensureWeek(db, weekKey, settings, availableRecipes);

    if (weekKey === currentWeekKey) weekState = ws;

    for (const uid of ws.candidates) usedUids.add(uid);
    upcomingWeeks.push({ weekKey, weekState: ws });
  }

  return { db, settings, recipeCache, currentWeekKey, weekState, recipesByUid, upcomingWeeks };
}

async function refresh() {
  ctx = await loadState(ctx.db);
  renderCurrentTab();
}

function navigate(view, params = {}) {
  currentTab = view;
  navParams = params;
  renderCurrentTab();
}

function renderCurrentTab() {
  appEl.innerHTML = "";
  views[currentTab](appEl, { ...ctx, navigate, params: navParams }, refresh);
}

function setupTabs() {
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentTab = btn.dataset.view;
      navParams = {};
      document.querySelectorAll(".tab-button").forEach((b) => b.classList.toggle("active", b === btn));
      renderCurrentTab();
    });
  });
  document.querySelector(`.tab-button[data-view="${currentTab}"]`)?.classList.add("active");
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
