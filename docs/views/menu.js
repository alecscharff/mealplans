import { createAutosave } from "../shared/autosave.js";
import { WEEK_DAYS, assignedDay, dayPlan, replaceMealDay } from "../shared/weekNotes.js";
import { saveWeekState } from "../firestore.js";
import { generateCandidates, replaceCandidate } from "../shared/candidates.js";
import { deriveTags, PROTEIN_TAG_OPTIONS } from "../shared/recipeTags.js";
import {
  isActiveForSuggestions,
  filterRecipes,
  sortByRecentlyAdded,
  TIME_FILTER_OPTIONS,
} from "../shared/recipeFilter.js";
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
  const { upcomingWeeks, recipesByUid, recipeCache, currentWeekKey, settings, db, navigate, setLeaveGuard } = ctx;
  const dirtyChecks = [];
  const dirtyStateChecks = [];

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
        registerDirtyCheck: (fn, isDirty) => { dirtyChecks.push(fn); dirtyStateChecks.push(isDirty); },
        refresh,
      })
    );
  }
  setLeaveGuard?.(() => dirtyChecks.every((fn) => fn()), () => dirtyStateChecks.some((fn) => fn()));
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
  registerDirtyCheck,
  refresh,
}) {
  const section = document.createElement("section");
  section.className = "week-section";
  section.id = `week-${weekKey}`;

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

  const undoRow = document.createElement("div");
  undoRow.className = "plan-undo";
  undoRow.hidden = true;
  const undoMessage = document.createElement("span");
  undoMessage.setAttribute("role", "status");
  const undoButton = document.createElement("button");
  undoButton.type = "button";
  undoButton.className = "pick-button";
  undoButton.textContent = "Undo";
  undoRow.append(undoMessage, undoButton);
  section.append(undoRow);
  const overview = document.createElement("details");
  overview.className = "week-overview";
  const overviewTitle = document.createElement("summary");
  overviewTitle.textContent = "Week at a glance";
  const overviewList = document.createElement("dl");
  overview.append(overviewTitle, overviewList);
  section.append(overview);

  const list = document.createElement("div");
  section.appendChild(list);

  const picker = document.createElement("div");
  picker.className = "all-recipes-picker";
  picker.hidden = true;
  section.appendChild(picker);

  const notes = document.createElement("div");
  notes.className = "week-notes";
  const noteLabel = document.createElement("label");
  noteLabel.textContent = "Notes for the week (optional)";
  const noteInput = document.createElement("textarea");
  noteInput.rows = 2;
  noteInput.placeholder = "Leftovers, dinner out, or anything else to remember…";
  noteInput.value = weekState.note || "";
  noteLabel.append(noteInput);
  notes.append(noteLabel);
  const dayDetails = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Day-by-day notes (optional)";
  dayDetails.append(summary);
  dayDetails.open = (weekState.dayNotes || []).some(Boolean);
  const dayInputs = WEEK_DAYS.map((day, index) => {
    const label = document.createElement("label");
    label.textContent = day;
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "e.g. Leftovers or dinner out";
    input.value = weekState.dayNotes?.[index] || "";
    label.append(input);
    dayDetails.append(label);
    return input;
  });
  notes.append(dayDetails);
  section.append(notes);
  const readNotes = () => ({ note: noteInput.value, dayNotes: dayInputs.map(input => input.value) });
  for (const input of [noteInput, ...dayInputs]) {
    input.addEventListener("input", () => { renderOverview(); queueSave(600); });
  }

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Use these suggestions";
  saveButton.className = "pick-button";
  section.appendChild(saveButton);
  const saveStatus = document.createElement("p");
  saveStatus.className = "note-inline";
  saveStatus.setAttribute("role", "status");
  section.appendChild(saveStatus);

  // Show saved picks (including an explicitly empty plan), or two unconfirmed suggestions.
  // Notes and alternative shuffles do not implicitly confirm those suggestions.
  let candidates = weekState.candidates.slice();
  let selected = weekState.planConfirmed || weekState.picks.length > 0 ? weekState.picks.slice() : candidates.slice(0, 2);
  let dayAssignments = Array.isArray(weekState.dayAssignments) ? structuredClone(weekState.dayAssignments) : [];
  overview.open = dayAssignments.length > 0 || (weekState.dayNotes || []).some(Boolean);
  let undoSnapshot = null, undoTimer;
  function clearUndo() {
    clearTimeout(undoTimer);
    undoSnapshot = null;
    undoRow.hidden = true;
  }
  function rememberPlan(message) {
    clearUndo();
    undoSnapshot = structuredClone({ candidates, selected, dayAssignments, originallySaved, shuffleNonce });
    undoMessage.textContent = message;
    undoRow.hidden = false;
    undoTimer = setTimeout(clearUndo, 15000);
  }
  undoButton.onclick = () => {
    if (!undoSnapshot) return;
    ({ candidates, selected, dayAssignments, originallySaved, shuffleNonce } = undoSnapshot);
    clearUndo();
    queueSave();
    renderList();
    if (!picker.hidden) renderPicker();
    saveStatus.focus();
  };
  function renderOverview() {
    overviewList.replaceChildren();
    const rows = dayPlan({ picks: originallySaved ? selected : [], dayAssignments, ...readNotes() }, recipesByUid);
    for (const row of rows) {
      const term = document.createElement("dt");
      term.textContent = row.day;
      const description = document.createElement("dd");
      description.textContent = [...row.meals, row.note].filter(Boolean).join(" · ") || "Not scheduled";
      overviewList.append(term, description);
    }
  }
  let hasUserChanges = false;
  let originallySaved = !!weekState.planConfirmed || weekState.picks.length > 0;
  let shuffleNonce = weekState.shuffleNonce || 0;
  let loadedUpdatedAt = weekState.updatedAt || null;
  let saveState = { pending: false, saving: false, error: null };
  saveStatus.tabIndex = -1;
  const autosave = createAutosave({
    save: snapshot => saveWeekState(db, weekKey, snapshot, loadedUpdatedAt),
    onSaved(snapshot, updatedAt) {
      loadedUpdatedAt = updatedAt;
      Object.assign(weekState, snapshot, { updatedAt });
    },
    onState(state) { saveState = state; hasUserChanges = state.pending; updateSaveState(); },
  });
  registerDirtyCheck?.(() => {
    if (!hasUserChanges) return true;
    if (saveState.saving) { alert("Your plan is still saving. Please wait before leaving."); return false; }
    if (!confirm("Your latest changes have not saved. Leave without saving them?")) return false;
    autosave.dispose();
    return true;
  }, () => hasUserChanges);
  function queueSave(delay = 0) {
    autosave.schedule({ candidates, picks: originallySaved ? selected : [], planConfirmed: originallySaved,
      shuffleNonce, dayAssignments: dayAssignments.filter(entry => selected.includes(entry.uid)), ...readNotes() }, delay);
  }
  function updateSaveState() {
    const conflict = saveState.error?.code === "week-conflict";
    saveButton.hidden = originallySaved && !saveState.error;
    saveButton.disabled = saveState.saving;
    saveButton.textContent = conflict ? "Reload latest plan" : saveState.error ? "Retry save" : "Use these suggestions";
    saveStatus.textContent = conflict
      ? "This week changed on another device. Your edits are still here, but weren't saved. Reload to review the latest plan."
      : saveState.error ? "Couldn't save. Your changes are still here—retry when you're connected."
      : saveState.pending ? "Saving…"
      : originallySaved ? "Saved" : "Suggested meals · choose Use these suggestions to confirm. Notes save automatically.";
  }
  function replaceSelected(index, uid) {
    const previous = selected[index];
    dayAssignments = replaceMealDay(dayAssignments, previous, uid);
    selected[index] = uid;
    candidates = replaceCandidate(candidates, previous, uid);
  }
  function chooseRecipe(uid, trigger) {
    function apply(index) {
      rememberPlan(index == null ? "Meal selection changed" : "Meal replaced");
      if (index == null) togglePick(uid);
      else replaceSelected(index, uid);
      originallySaved = true;
      queueSave();
      renderList();
      if (!picker.hidden) renderPicker();
      updateSaveState();
    }
    if (selected.includes(uid) || selected.length < 2) { apply(); return; }
    const dialog = document.createElement("dialog");
    dialog.className = "replace-dialog";
    const title = document.createElement("h3");
    title.id = `replace-title-${weekKey}`;
    title.textContent = "Which meal would you like to replace?";
    dialog.setAttribute("aria-labelledby", title.id);
    const description = document.createElement("p");
    description.textContent = `Adding ${recipesByUid[uid]?.name || "this recipe"}`;
    dialog.append(title, description);
    selected.forEach((pickedUid, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "replace-option";
      button.append(createRecipeThumb(recipesByUid[pickedUid] || {}));
      const label = document.createElement("span");
      label.textContent = recipesByUid[pickedUid]?.name || "Selected meal";
      button.append(label);
      button.onclick = () => { dialog.close(); apply(index); saveStatus.focus(); };
      dialog.append(button);
    });
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "pick-button";
    cancel.textContent = "Cancel";
    cancel.onclick = () => dialog.close();
    dialog.append(cancel);
    dialog.addEventListener("close", () => { dialog.remove(); if (trigger.isConnected) trigger.focus(); });
    section.append(dialog);
    dialog.showModal();
  }
  let pickerFilters = { query: "", protein: "", maxMinutes: null };

  // Recipes already showing up in any other displayed week — excluded from both the
  // shuffle pool and the all-recipes picker, so nothing can be suggested/picked twice
  // across the 4-week view.
  function usedByOtherWeeks() {
    return new Set(upcomingWeeks.filter((w) => w.weekKey !== weekKey).flatMap((w) => w.weekState.candidates));
  }

  function togglePick(uid) {
    if (selected.includes(uid)) {
      dayAssignments = dayAssignments.filter(entry => entry.uid !== uid);
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
    renderOverview();
    list.innerHTML = "";
    for (const uid of [...selected, ...candidates.filter(id => !selected.includes(id))]) {
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
      name.addEventListener("click", () => navigate("detail", { uid, from: "menu", weekKey }));
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
      if (selected.includes(uid)) {
        const dayLabel = document.createElement("label");
        dayLabel.className = "meal-day";
        dayLabel.textContent = "Day (optional)";
        const daySelect = document.createElement("select");
        daySelect.setAttribute("aria-label", `Day for ${recipe.name}`);
        daySelect.add(new Option("Any day", ""));
        WEEK_DAYS.forEach((day, index) => daySelect.add(new Option(day, String(index))));
        const day = assignedDay(dayAssignments, uid);
        daySelect.value = day == null ? "" : String(day);
        daySelect.onchange = () => {
          clearUndo();
          dayAssignments = dayAssignments.filter(entry => entry.uid !== uid);
          if (daySelect.value !== "") dayAssignments.push({ uid, day: Number(daySelect.value) });
          originallySaved = true;
          overview.open = true;
          queueSave();
          renderList();
        };
        dayLabel.append(daySelect);
        info.append(dayLabel);
      }
      card.appendChild(info);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "pick-button" + (selected.includes(uid) ? " selected" : "");
      button.textContent = selected.includes(uid) ? (!originallySaved ? "Suggested" : "Picked") : selected.length >= 2 ? "Replace…" : "Pick";
      button.setAttribute("aria-pressed", String(selected.includes(uid)));
      button.addEventListener("click", () => chooseRecipe(uid, button));
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
    searchInput.setAttribute("aria-label", "Search recipes");
    searchInput.addEventListener("input", () => {
      pickerFilters = { ...pickerFilters, query: searchInput.value };
      renderPickerList();
    });
    filterRow.appendChild(searchInput);

    const proteinSelect = document.createElement("select");
    proteinSelect.setAttribute("aria-label", "Filter by protein");
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
    timeSelect.setAttribute("aria-label", "Filter by cook time");
    const anyTimeOption = document.createElement("option");
    anyTimeOption.value = "";
    anyTimeOption.textContent = "Any time";
    timeSelect.appendChild(anyTimeOption);
    for (const minutes of TIME_FILTER_OPTIONS) {
      const option = document.createElement("option");
      option.value = minutes;
      option.textContent = `${minutes} min or less (known time)`;
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
      const matches = sortByRecentlyAdded(filterRecipes(eligible, pickerFilters))
        .sort((a, b) => Number(selected.includes(b.uid)) - Number(selected.includes(a.uid)));

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
        useButton.textContent = isSelected ? "Picked" : selected.length >= 2 ? "Replace…" : "Use this recipe";
        useButton.addEventListener("click", () => chooseRecipe(recipe.uid, useButton));
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

  saveButton.addEventListener("click", () => {
    if (saveState.error?.code === "week-conflict") {
      if (confirm("Discard your unsaved changes and reload the latest plan?")) {
        autosave.dispose(); hasUserChanges = false; location.reload();
      }
      return;
    }
    if (saveState.error) { autosave.retry(); return; }
    clearUndo();
    originallySaved = true;
    queueSave();
    renderList();
    if (!picker.hidden) renderPicker();
  });

  shuffleButton.addEventListener("click", () => {
    rememberPlan("Alternatives shuffled");
    // Shuffling alternatives does not confirm the initial suggestions.
    const kept = selected.slice(0, CANDIDATES_PER_WEEK);
    const excluded = new Set([...usedByOtherWeeks(), ...kept]);
    const availableRecipes = recipeCache.recipes.filter(r => isActiveForSuggestions(r) && !excluded.has(r.uid));
    shuffleNonce++;
    const replacements = generateCandidates(availableRecipes, weekKey, candidateSeed(settings, shuffleNonce), {
      takeCount: Math.max(CANDIDATES_PER_WEEK - kept.length, 0),
    });
    candidates = [...kept, ...replacements];
    queueSave();
    renderList();
    if (!picker.hidden) renderPicker();
  });

  renderList();
  updateSaveState();
  return section;
}
