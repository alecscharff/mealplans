import { scrapeRecipeUrl } from "../functionsClient.js";
import { addRecipe, updateRecipe, deleteRecipe } from "../firestore.js";
import { filterRecipes, isActiveForSuggestions, TIME_FILTER_OPTIONS } from "../shared/recipeFilter.js";
import { PROTEIN_TAG_OPTIONS } from "../shared/recipeTags.js";
import { createRecipeThumb } from "./recipeImage.js";
import { canonicalRecipeUrl } from "../shared/canonicalUrl.js";
import { parseIngredientsRaw } from "../shared/ingredientParser.js";

export function renderAddRecipe(container, ctx, refresh) {
  const { db, recipeCache, navigate, setLeaveGuard } = ctx;
  let scraped = null;
  let draftDirty = false;
  setLeaveGuard?.(() => !draftDirty || confirm("Your recipe entry has unsaved changes. Leave without saving?"), () => draftDirty);

  const intro = document.createElement("p");
  intro.className = "note-inline";
  intro.textContent = "Import recipes, add one by hand, or save a meal idea with mix-ins and variations.";
  container.appendChild(intro);
  const actions = document.createElement("div");
  actions.className = "recipe-actions";
  const mode = document.createElement("p");
  mode.setAttribute("role", "status");
  actions.appendChild(mode);
  container.appendChild(actions);

  const form = document.createElement("form");
  form.className = "settings-form";
  form.addEventListener("input", () => { draftDirty = true; });

  const urlHeading = document.createElement("h3");
  urlHeading.textContent = "Import from a recipe page";
  form.appendChild(urlHeading);
  const urlLabel = document.createElement("label");
  urlLabel.textContent = "Recipe URL";
  const urlInput = document.createElement("input");
  // type="text" (not "url") — a native url input rejects anything without a scheme,
  // so pasting a bare "www.example.com/..." (no "https://") would silently block
  // submission. We normalize the scheme ourselves below instead.
  urlInput.type = "text";
  urlInput.required = true;
  urlInput.placeholder = "www.example.com/some-recipe";
  urlLabel.appendChild(urlInput);
  form.appendChild(urlLabel);

  const fetchButton = document.createElement("button");
  fetchButton.type = "submit";
  fetchButton.className = "pick-button";
  fetchButton.textContent = "Fetch recipe";
  form.appendChild(fetchButton);
  container.appendChild(form);

  const manual = document.createElement("form");
  manual.className = "settings-form";
  manual.hidden = true;
  manual.addEventListener("input", () => { draftDirty = true; });
  const manualHeading = document.createElement("h3");
  manualHeading.textContent = "Add manually";
  manual.appendChild(manualHeading);
  const manualName = document.createElement("input");
  manualName.required = true;
  manualName.placeholder = "Recipe name";
  const manualNameLabel = document.createElement("label");
  manualNameLabel.textContent = "Name"; manualNameLabel.appendChild(manualName); manual.appendChild(manualNameLabel);
  const manualSource = document.createElement("input");
  manualSource.placeholder = "https://… (optional)";
  const manualSourceLabel = document.createElement("label");
  manualSourceLabel.textContent = "Source link"; manualSourceLabel.appendChild(manualSource); manual.appendChild(manualSourceLabel);
  const manualYield = document.createElement("input"); manualYield.type = "number"; manualYield.min = "1"; manualYield.placeholder = "4";
  const yieldLabel = document.createElement("label"); yieldLabel.textContent = "Servings"; yieldLabel.appendChild(manualYield); manual.appendChild(yieldLabel);
  const manualTime = document.createElement("input"); manualTime.type = "number"; manualTime.min = "1";
  const timeLabel = document.createElement("label"); timeLabel.textContent = "Total time (minutes)"; timeLabel.appendChild(manualTime); manual.appendChild(timeLabel);
  const manualIngredients = document.createElement("textarea"); manualIngredients.rows = 7; manualIngredients.placeholder = "One ingredient per line";
  const ingredientLabel = document.createElement("label"); ingredientLabel.textContent = "Ingredients"; ingredientLabel.appendChild(manualIngredients); manual.appendChild(ingredientLabel);
  const manualDirections = document.createElement("textarea"); manualDirections.rows = 7; manualDirections.placeholder = "One step per line";
  const directionLabel = document.createElement("label"); const directionLabelText = document.createTextNode("Steps"); directionLabel.appendChild(directionLabelText); directionLabel.appendChild(manualDirections); manual.appendChild(directionLabel);
  const manualProtein = document.createElement("select");
  const manualAuto = document.createElement("option"); manualAuto.value = ""; manualAuto.textContent = "Automatic"; manualProtein.appendChild(manualAuto);
  for (const tag of PROTEIN_TAG_OPTIONS) { const o = document.createElement("option"); o.value = tag; o.textContent = tag; manualProtein.appendChild(o); }
  manualProtein.value = "";
  const proteinLabel = document.createElement("label"); proteinLabel.textContent = "Protein / diet tag"; proteinLabel.appendChild(manualProtein); manual.appendChild(proteinLabel);
  const manualSave = document.createElement("button"); manualSave.className = "pick-button"; manualSave.textContent = "Save recipe"; manualSave.type = "submit"; manual.appendChild(manualSave);
  const manualStatus = document.createElement("p"); manualStatus.setAttribute("role", "status"); manual.appendChild(manualStatus);
  container.appendChild(manual);
  function showMode(selected) { form.hidden = selected !== "import"; manual.hidden = selected === "import"; mode.textContent = `${selected === "import" ? "Import URL" : selected === "manual" ? "Manual recipe" : "Meal idea"} selected`; }
  for (const [value, label] of [["import", "Import URL"], ["manual", "Add manually"], ["idea", "Meal idea"]]) {
    const button = document.createElement("button"); button.type = "button"; button.className = "pick-button"; button.textContent = label;
    button.addEventListener("click", () => {
      showMode(value);
      manualHeading.textContent = value === "idea" ? "Save a meal idea" : "Add manually";
      ingredientLabel.hidden = value === "idea"; manualIngredients.required = value !== "idea";
      yieldLabel.hidden = value === "idea"; timeLabel.hidden = value === "idea";
      directionLabelText.nodeValue = value === "idea" ? "Mix-ins, variations and dressing ideas" : "Steps";
      manualDirections.placeholder = value === "idea" ? "Examples: toppings, swaps, grains, dressings" : "One step per line";
      directionLabel.hidden = value === "idea" ? false : false;
      manualSave.textContent = value === "idea" ? "Save meal idea" : "Save recipe";
      manual.dataset.kind = value;
    });
    actions.appendChild(button);
  }
  manual.addEventListener("submit", async (e) => {
    e.preventDefault();
    const kind = manual.dataset.kind || "manual";
    const ingredientsRaw = kind === "idea" ? "" : manualIngredients.value.trim();
    if (!manualName.value.trim()) { manualStatus.textContent = "Enter a name before saving."; manualName.focus(); return; }
    if (kind === "manual" && !ingredientsRaw && !manualDirections.value.trim()) { manualStatus.textContent = "Add ingredients or steps before saving."; return; }
    manualSave.disabled = true; manualSave.textContent = "Saving…";
    try {
      const url = manualSource.value.trim() ? canonicalRecipeUrl(/^https?:/i.test(manualSource.value.trim()) ? manualSource.value.trim() : `https://${manualSource.value.trim()}`) : null;
      if (manualSource.value.trim() && !url) throw new Error("Enter a valid HTTP or HTTPS source link.");
      await addRecipe(db, { uid: crypto.randomUUID(), name: manualName.value.trim(), sourceUrl: url, servings: kind === "idea" ? null : (manualYield.value ? Number(manualYield.value) : null), totalTimeMinutes: kind === "idea" || !manualTime.value ? null : Number(manualTime.value), image: null, ingredientsRaw, ingredientsParsed: parseIngredientsRaw(ingredientsRaw), directions: manualDirections.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean), ...(kind === "idea" ? { mealIdea: true, proteinTag: manualProtein.value || null } : { proteinTag: manualProtein.value || null }), lastCooked: null, addedAt: new Date().toISOString() });
      draftDirty = false;
      await refresh();
    } catch (err) { manualStatus.textContent = `Couldn't save: ${err.message}. Your entry is still here; try again.`; }
    finally { manualSave.disabled = false; manualSave.textContent = kind === "idea" ? "Save meal idea" : "Save recipe"; }
  });

  const statusEl = document.createElement("p");
  container.appendChild(statusEl);

  const preview = document.createElement("div");
  container.appendChild(preview);

  function renderPreview() {
    preview.innerHTML = "";
    if (!scraped) return;

    const card = document.createElement("div");
    card.className = "recipe-card recipe-preview";

    card.appendChild(createRecipeThumb(scraped, "recipe-thumb-hero"));

    const name = document.createElement("input"); name.value = scraped.name; name.setAttribute("aria-label", "Recipe name");
    card.appendChild(name);
    const servings = document.createElement("input"); servings.type = "number"; servings.min = "1"; servings.value = scraped.servings || ""; servings.setAttribute("aria-label", "Servings");
    const minutes = document.createElement("input"); minutes.type = "number"; minutes.min = "1"; minutes.value = scraped.totalTimeMinutes || ""; minutes.setAttribute("aria-label", "Total time in minutes");
    for (const [labelText, input] of [["Servings", servings], ["Total time (minutes)", minutes]]) { const label = document.createElement("label"); label.append(document.createTextNode(labelText), input); card.appendChild(label); }

    const ingredients = document.createElement("textarea"); ingredients.rows = 7; ingredients.value = scraped.ingredientsRaw; ingredients.setAttribute("aria-label", "Ingredients");
    const directions = document.createElement("textarea"); directions.rows = 7; directions.value = scraped.directions.join("\n"); directions.setAttribute("aria-label", "Instructions");
    for (const [labelText, input] of [["Ingredients", ingredients], ["Instructions", directions]]) { const label = document.createElement("label"); label.append(document.createTextNode(labelText), input); card.appendChild(label); }
    for (const input of [name, servings, minutes, ingredients, directions]) input.addEventListener("input", () => { draftDirty = true; });

    const identity = canonicalRecipeUrl(scraped.sourceUrl);
    const existing = recipeCache.recipes.find((r) => canonicalRecipeUrl(r.sourceUrl) === identity);
    if (existing) {
      const comparison = document.createElement("details"); comparison.className = "notice";
      const summary = document.createElement("summary"); summary.textContent = `Compare with saved “${existing.name}” before replacing it`; comparison.appendChild(summary);
      const oldContent = document.createElement("pre"); oldContent.textContent = `Saved ingredients:\n${existing.ingredientsRaw || "(none)"}\n\nSaved instructions:\n${(existing.directions || []).join("\n")}`; comparison.appendChild(oldContent);
      const newContent = document.createElement("p"); newContent.textContent = `The editable preview contains ${scraped.ingredientsParsed.length} imported ingredients and ${scraped.directions.length} imported steps. Saving replaces the saved content with the edited preview.`; comparison.appendChild(newContent);
      card.appendChild(comparison);
    }

    const saveButton = document.createElement("button");
    saveButton.className = "pick-button";
    saveButton.textContent = existing ? "Update existing recipe" : "Add to menu rotation";
    saveButton.addEventListener("click", async () => {
      if (!name.value.trim()) { statusEl.textContent = "Enter a recipe name before saving."; name.focus(); return; }
      if ((servings.value && (!Number.isInteger(Number(servings.value)) || Number(servings.value) < 1)) || (minutes.value && (!Number.isInteger(Number(minutes.value)) || Number(minutes.value) < 1))) {
        statusEl.textContent = "Servings and total time must be positive whole numbers."; return;
      }
      saveButton.disabled = true;
      saveButton.textContent = "Saving…";
      const fields = {
        name: name.value.trim(),
        sourceUrl: scraped.sourceUrl,
        servings: Number(servings.value) || null,
        image: scraped.image,
        totalTimeMinutes: Number(minutes.value) || null,
        ingredientsRaw: ingredients.value.trim(),
        ingredientsParsed: parseIngredientsRaw(ingredients.value.trim()),
        directions: directions.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
      };
      try {
        if (existing) await updateRecipe(db, existing.uid, fields);
        else await addRecipe(db, { uid: crypto.randomUUID(), ...fields, lastCooked: null, addedAt: new Date().toISOString() });
        draftDirty = false;
        urlInput.value = ""; scraped = null; await refresh();
      } catch (err) { statusEl.textContent = `Couldn't save: ${err.message}. Review the preview and try again.`; saveButton.disabled = false; saveButton.textContent = existing ? "Retry update" : "Retry save"; }
    });
    card.appendChild(saveButton);

    if (existing) {
      const note = document.createElement("p");
      note.className = "note-inline";
      note.textContent = "This URL is already in your rotation — saving will update that recipe instead of adding a duplicate.";
      card.appendChild(note);
    }

    preview.appendChild(card);
  }

  function normalizeUrl(value) {
    const trimmed = value.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    scraped = null;
    preview.innerHTML = "";
    fetchButton.disabled = true;
    statusEl.textContent = "Fetching…";
    try {
      scraped = await scrapeRecipeUrl(normalizeUrl(urlInput.value));
      statusEl.textContent = "";
      renderPreview();
      } catch (err) {
        statusEl.textContent = `Couldn't fetch that recipe: ${err.message}`;
        const fallback = document.createElement("button");
        fallback.type = "button"; fallback.className = "pick-button"; fallback.textContent = "Enter it manually";
        fallback.addEventListener("click", () => { showMode("manual"); manualHeading.textContent = "Add manually"; manual.dataset.kind = "manual"; });
        statusEl.appendChild(document.createTextNode(" ")); statusEl.appendChild(fallback);
    } finally {
      fetchButton.disabled = false;
    }
  });

  const existingHeading = document.createElement("h3");
  existingHeading.textContent = "Recipes in rotation";
  container.appendChild(existingHeading);

  if (recipeCache.recipes.length === 0) {
    const notice = document.createElement("div");
    notice.className = "notice";
    notice.textContent = "No recipes yet — paste a URL above to add your first one. New recipes join the pool starting next week's menu.";
    container.appendChild(notice);
    return;
  }

  const filterRow = document.createElement("div");
  filterRow.className = "picker-filter-row";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search recipes…";
  searchInput.className = "picker-search";
  searchInput.setAttribute("aria-label", "Search recipes");
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
  filterRow.appendChild(timeSelect);

  container.appendChild(filterRow);

  const list = document.createElement("div");
  list.className = "recipe-chip-row";
  container.appendChild(list);

  function renderRecipeList() {
    list.innerHTML = "";
    const matches = filterRecipes(recipeCache.recipes, {
      query: searchInput.value,
      protein: proteinSelect.value,
      maxMinutes: timeSelect.value ? Number(timeSelect.value) : null,
    });

    if (matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "note-inline";
      empty.textContent = "No recipes match that search.";
      list.appendChild(empty);
      return;
    }

    for (const recipe of matches) {
      const chip = document.createElement("div");
      chip.className = "recipe-chip" + (isActiveForSuggestions(recipe) ? "" : " recipe-chip-skipped");
      chip.appendChild(createRecipeThumb(recipe, "recipe-thumb-sm"));

      const link = document.createElement("button");
      link.type = "button";
      link.className = "recipe-name-link";
      link.textContent = isActiveForSuggestions(recipe) ? recipe.name : `${recipe.name} (skipped)`;
      link.addEventListener("click", () => navigate("editRecipe", { uid: recipe.uid, from: "addRecipe" }));
      chip.appendChild(link);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "chip-delete";
      deleteButton.textContent = "×";
      deleteButton.setAttribute("aria-label", `Remove ${recipe.name}`);
      deleteButton.addEventListener("click", async () => {
        if (!confirm(`Remove "${recipe.name}" from the rotation?`)) return;
        deleteButton.disabled = true;
        try { await deleteRecipe(db, recipe.uid); await refresh(); }
        catch (err) { deleteButton.disabled = false; deleteButton.title = `Couldn't remove recipe: ${err.message}`; }
      });
      chip.appendChild(deleteButton);

      list.appendChild(chip);
    }
  }

  searchInput.addEventListener("input", renderRecipeList);
  proteinSelect.addEventListener("change", renderRecipeList);
  timeSelect.addEventListener("change", renderRecipeList);
  renderRecipeList();
}
