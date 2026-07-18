import { saveWeekState } from "../firestore.js";
import { generateCandidates } from "../shared/candidates.js";
import { deriveTags, PROTEIN_TAG_OPTIONS } from "../shared/recipeTags.js";
import { isActiveForSuggestions, filterRecipes, TIME_FILTER_OPTIONS } from "../shared/recipeFilter.js";
import { weeksBetween } from "../shared/weekKey.js";
import { createRecipeThumb } from "./recipeImage.js";
import { formatWeekLabel } from "./weekLabel.js";

const CANDIDATES_PER_WEEK = 4;

function candidateSeed(settings, shuffleNonce) {
  return `${settings.shuffleSeed || "sunday-menu"}:${shuffleNonce || 0}`;
}

// "Last made 3 weeks ago" / "Last made this week" / "Never made" — lastCooked is a
// weekKey string set by the rollover pass (see shared/rollover.js), or null.
function lastCookedLabel(recipe, currentWeekKey) {
  if (!recipe.lastCooked) return "Never made";
  const weeks = weeksBetween(recipe.lastCooked, currentWeekKey);
  if (weeks <= 0) return "Last made this week";
  if (weeks === 1) return "Last made 1 week ago";
  return `Last made ${weeks} weeks ago`;
}

export function renderMenu(container, ctx, refresh) {
  const { upcomingWeeks, recipesByUid, recipeCache, currentWeekKey, settings, db, navigate } = ctx;

  for (const { weekKey, weekState } of upcomingWeeks) {
    container.appendChild(
      renderWeekSection({
        weekKey,
        weekState,
        upcomingWeeks,
        recipesByUid,
        recipeCache,
        currentWeekKey,
        settings,
        db,
        navigate,
        refresh,
      })
    );
  }
}

function renderWeekSection({
  weekKey,
  weekState,
  upcomingWeeks,
  recipesByUid,
  recipeCache,
  currentWeekKey,
  settings,
  db,
  navigate,
  refresh,
}) {
  const section = document.createElement("section");
  section.className = "week-section";

  const headerRow = document.createElement("div");
  headerRow.className = "week-header";
  const heading = document.createElement("h3");
  heading.textContent = formatWeekLabel(weekKey);
  headerRow.appendChild(heading);

  const headerActions = document.createElement("div");
  headerActions.className = "week-header-actions";

  const pickerToggle = document.createElement("button");
  pickerToggle.type = "button";
  pickerToggle.className = "pick-button shuffle-button";
  pickerToggle.textContent = "Pick from all recipes";
  headerActions.appendChild(pickerToggle);

  const shuffleButton = document.createElement("button");
  shuffleButton.type = "button";
  shuffleButton.className = "pick-button shuffle-button";
  shuffleButton.textContent = "Shuffle";
  headerActions.appendChild(shuffleButton);

  headerRow.appendChild(headerActions);
  section.appendChild(headerRow);

  const list = document.createElement("div");
  section.appendChild(list);

  const picker = document.createElement("div");
  picker.className = "all-recipes-picker";
  picker.hidden = true;
  section.appendChild(picker);

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Save picks";
  saveButton.className = "pick-button";
  section.appendChild(saveButton);

  // Two picks are always shown as selected — either confirmed picks, or (before a save)
  // the top two candidates as a default suggestion — plus alternatives to swap in.
  // `candidates` is a local working copy so "pick from all recipes" can swap an
  // alternative slot for a manually-chosen recipe without touching Firestore until Save.
  let candidates = weekState.candidates.slice();
  let selected = weekState.picks.length > 0 ? weekState.picks.slice() : candidates.slice(0, 2);
  let pickerFilters = { query: "", protein: "", maxMinutes: null };

  // Recipes already showing up in any other displayed week — excluded from both the
  // shuffle pool and the all-recipes picker, so nothing can be suggested/picked twice
  // across the 4-week view.
  function usedByOtherWeeks() {
    return new Set(upcomingWeeks.filter((w) => w.weekKey !== weekKey).flatMap((w) => w.weekState.candidates));
  }

  function togglePick(uid) {
    if (selected.includes(uid)) {
      selected = selected.filter((id) => id !== uid);
      return;
    }
    if (selected.length >= 2) return;
    if (!candidates.includes(uid)) {
      // Manually picking a recipe that isn't already one of this week's candidate
      // cards — swap it into an unselected alternative's slot so the candidate count
      // (and therefore app.js's regenerate-on-load guard) stays stable.
      const swapOut = candidates.find((id) => !selected.includes(id));
      candidates = swapOut != null ? candidates.map((id) => (id === swapOut ? uid : id)) : [...candidates, uid];
    }
    selected = [...selected, uid];
  }

  function renderList() {
    list.innerHTML = "";
    for (const uid of candidates) {
      const recipe = recipesByUid[uid];
      if (!recipe) continue;

      const card = document.createElement("div");
      card.className = "recipe-card" + (selected.includes(uid) ? " picked" : "");
      card.appendChild(createRecipeThumb(recipe));

      const info = document.createElement("div");
      info.className = "recipe-card-info";
      const name = document.createElement("button");
      name.type = "button";
      name.className = "recipe-name-link";
      name.textContent = recipe.name;
      name.addEventListener("click", () => navigate("detail", { uid, from: "menu" }));
      info.appendChild(name);

      const meta = document.createElement("div");
      meta.className = "recipe-meta";
      if (recipe.totalTimeMinutes) {
        const time = document.createElement("span");
        time.className = "recipe-time";
        time.textContent = `${recipe.totalTimeMinutes} min`;
        meta.appendChild(time);
      }
      for (const tag of deriveTags(recipe)) {
        const tagEl = document.createElement("span");
        tagEl.className = "recipe-tag";
        tagEl.textContent = tag;
        meta.appendChild(tagEl);
      }
      info.appendChild(meta);

      const lastCooked = document.createElement("div");
      lastCooked.className = "note-inline";
      lastCooked.textContent = lastCookedLabel(recipe, currentWeekKey);
      info.appendChild(lastCooked);

      if (!selected.includes(uid)) {
        const badge = document.createElement("div");
        badge.className = "badge badge-alt";
        badge.textContent = "alternative";
        info.appendChild(badge);
      }
      card.appendChild(info);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "pick-button" + (selected.includes(uid) ? " selected" : "");
      button.textContent = selected.includes(uid) ? "Picked" : "Pick";
      button.disabled = !selected.includes(uid) && selected.length >= 2;
      button.addEventListener("click", () => {
        togglePick(uid);
        renderList();
        if (!picker.hidden) renderPicker();
      });
      card.appendChild(button);

      list.appendChild(card);
    }
  }

  function renderPicker() {
    picker.innerHTML = "";
    if (picker.hidden) return;

    const filterRow = document.createElement("div");
    filterRow.className = "picker-filter-row";

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search recipes…";
    searchInput.value = pickerFilters.query;
    searchInput.className = "picker-search";
    searchInput.addEventListener("input", () => {
      pickerFilters = { ...pickerFilters, query: searchInput.value };
      renderPickerList();
    });
    filterRow.appendChild(searchInput);

    const proteinSelect = document.createElement("select");
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "Any protein";
    proteinSelect.appendChild(allOption);
    for (const tag of PROTEIN_TAG_OPTIONS) {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      proteinSelect.appendChild(option);
    }
    proteinSelect.value = pickerFilters.protein;
    proteinSelect.addEventListener("change", () => {
      pickerFilters = { ...pickerFilters, protein: proteinSelect.value };
      renderPickerList();
    });
    filterRow.appendChild(proteinSelect);

    const timeSelect = document.createElement("select");
    const anyTimeOption = document.createElement("option");
    anyTimeOption.value = "";
    anyTimeOption.textContent = "Any time";
    timeSelect.appendChild(anyTimeOption);
    for (const minutes of TIME_FILTER_OPTIONS) {
      const option = document.createElement("option");
      option.value = minutes;
      option.textContent = `${minutes} min or less`;
      timeSelect.appendChild(option);
    }
    timeSelect.value = pickerFilters.maxMinutes || "";
    timeSelect.addEventListener("change", () => {
      pickerFilters = { ...pickerFilters, maxMinutes: timeSelect.value ? Number(timeSelect.value) : null };
      renderPickerList();
    });
    filterRow.appendChild(timeSelect);

    picker.appendChild(filterRow);

    const pickerList = document.createElement("div");
    pickerList.className = "picker-list";
    picker.appendChild(pickerList);

    function renderPickerList() {
      pickerList.innerHTML = "";
      const excluded = usedByOtherWeeks();
      const eligible = recipeCache.recipes.filter((r) => !excluded.has(r.uid));
      const matches = filterRecipes(eligible, pickerFilters);

      if (matches.length === 0) {
        const empty = document.createElement("p");
        empty.className = "note-inline";
        empty.textContent = "No recipes match that search.";
        pickerList.appendChild(empty);
        return;
      }

      for (const recipe of matches) {
        const row = document.createElement("div");
        row.className = "picker-row";
        row.appendChild(createRecipeThumb(recipe, "recipe-thumb-sm"));

        const rowInfo = document.createElement("div");
        rowInfo.className = "picker-row-info";
        const rowName = document.createElement("span");
        rowName.className = "picker-row-name";
        rowName.textContent = recipe.name;
        rowInfo.appendChild(rowName);
        if (!isActiveForSuggestions(recipe)) {
          const skippedNote = document.createElement("span");
          skippedNote.className = "note-inline";
          skippedNote.textContent = "Skipped from auto-suggestions";
          rowInfo.appendChild(skippedNote);
        }
        row.appendChild(rowInfo);

        const isSelected = selected.includes(recipe.uid);
        const useButton = document.createElement("button");
        useButton.type = "button";
        useButton.className = "pick-button" + (isSelected ? " selected" : "");
        useButton.textContent = isSelected ? "Picked" : "Use this recipe";
        useButton.disabled = !isSelected && selected.length >= 2;
        useButton.addEventListener("click", () => {
          togglePick(recipe.uid);
          renderList();
          renderPickerList();
        });
        row.appendChild(useButton);

        pickerList.appendChild(row);
      }
    }

    renderPickerList();
  }

  pickerToggle.addEventListener("click", () => {
    picker.hidden = !picker.hidden;
    pickerToggle.textContent = picker.hidden ? "Pick from all recipes" : "Hide all recipes";
    renderPicker();
  });

  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    await saveWeekState(db, weekKey, { candidates, picks: selected });
    await refresh();
  });

  shuffleButton.addEventListener("click", async () => {
    shuffleButton.disabled = true;
    shuffleButton.textContent = "Shuffling…";
    // Keep whatever is currently picked in place — only the unpicked alternatives get
    // reshuffled. Exclude recipes already showing up in any other displayed week, the
    // kept picks themselves, and recipes marked skipped (see shared/recipeFilter.js).
    const kept = selected.slice(0, CANDIDATES_PER_WEEK);
    const excluded = new Set([...usedByOtherWeeks(), ...kept]);
    const availableRecipes = recipeCache.recipes.filter((r) => isActiveForSuggestions(r) && !excluded.has(r.uid));
    const nextNonce = (weekState.shuffleNonce || 0) + 1;
    const replacements = generateCandidates(availableRecipes, weekKey, candidateSeed(settings, nextNonce), {
      takeCount: Math.max(CANDIDATES_PER_WEEK - kept.length, 0),
    });
    candidates = [...kept, ...replacements];
    await saveWeekState(db, weekKey, { candidates, shuffleNonce: nextNonce, picks: kept });
    await refresh();
  });

  renderList();
  return section;
}
