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

const appEl = document.getElementById("app");
const statusEl = document.getElementById("status");

const views = { menu: renderMenu, grocery: renderGrocery, settings: renderSettings };
let currentTab = "menu";
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
    weekState = { candidates, picks: [], autoPickedIds: [], groceryChecks: {}, archived: false };
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

function renderCurrentTab() {
  appEl.innerHTML = "";
  views[currentTab](appEl, ctx, refresh);
}

function setupTabs() {
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentTab = btn.dataset.view;
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
