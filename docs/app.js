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
import { weekKey as computeWeekKey, weekday } from "./shared/weekKey.js";
import { generateCandidates, applyDeadlineAutoPick } from "./shared/candidates.js";
import { computeRollover } from "./shared/rollover.js";
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

  // Load (or create) this week's state.
  let weekState = await getWeekState(db, currentWeekKey);
  if (!weekState) {
    const candidates = generateCandidates(recipeCache.recipes, currentWeekKey, settings.shuffleSeed || "sunday-menu");
    weekState = { candidates, picks: [], autoPickedIds: [], groceryChecks: {}, stepChecks: {}, archived: false };
    await saveWeekState(db, currentWeekKey, weekState);
  } else if (
    weekState.picks.length < 2 &&
    weekState.candidates.length < Math.min(recipeCache.recipes.length, 5)
  ) {
    // Recipes were added after this week's candidates were first generated (e.g.
    // still bootstrapping the recipe library). Regenerate to include them, as long as
    // picks aren't finalized yet — once you've picked, the pool stops shifting under you.
    const candidates = generateCandidates(recipeCache.recipes, currentWeekKey, settings.shuffleSeed || "sunday-menu");
    weekState = { ...weekState, candidates };
    await saveWeekState(db, currentWeekKey, weekState);
  }

  // Deadline auto-pick.
  const recipesByUid = Object.fromEntries(recipeCache.recipes.map((r) => [r.uid, r]));
  const autoPick = applyDeadlineAutoPick({
    todayWeekday: weekday(new Date()),
    deadlineDay: settings.deadlineDay,
    candidates: weekState.candidates,
    recipesByUid,
    picks: weekState.picks,
    autoPickedIds: weekState.autoPickedIds,
  });
  if (autoPick.picks.length !== weekState.picks.length) {
    weekState = { ...weekState, picks: autoPick.picks, autoPickedIds: autoPick.autoPickedIds };
    await saveWeekState(db, currentWeekKey, weekState);
  }

  return { db, settings, recipeCache, currentWeekKey, weekState, recipesByUid };
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
