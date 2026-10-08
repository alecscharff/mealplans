import { updateRecipe, deleteRecipe } from "../firestore.js";
import { parseIngredientsRaw } from "../shared/ingredientParser.js";
import { scrapeRecipeUrl } from "../functionsClient.js";
import { PROTEIN_TAG_OPTIONS, deriveProteinTag } from "../shared/recipeTags.js";

export function renderEditRecipe(container, ctx, refresh) {
  const { recipesByUid, db, navigate, params, setLeaveGuard } = ctx;
  const recipe = recipesByUid[params.uid];

  if (!recipe) {
    const notice = document.createElement("div");
    notice.className = "notice";
    notice.textContent = "Recipe not found.";
    container.appendChild(notice);
    return;
  }

  // Editing can be entered from the "recipes in rotation" list (Add Recipe tab) or
  // from the recipe detail view — return to whichever one, with the right params.
  function goBack() {
    if (params.from === "detail") {
      navigate("detail", { uid: recipe.uid, from: params.detailFrom || "menu", weekKey: params.weekKey, backParams: params.detailParams });
    } else {
      navigate(params.from || "addRecipe");
    }
  }

  const backButton = document.createElement("button");
  backButton.className = "pick-button";
  backButton.style.marginBottom = "0.9rem";
  backButton.textContent = "← Cancel";
  backButton.addEventListener("click", goBack);
  container.appendChild(backButton);

  const heading = document.createElement("h2");
  heading.textContent = "Edit recipe";
  container.appendChild(heading);

  const form = document.createElement("form");
  form.className = "settings-form";
  let dirty = false;
  setLeaveGuard?.(() => !dirty || confirm("This recipe has unsaved edits. Leave without saving?"), () => dirty);
  form.addEventListener("input", () => { dirty = true; });
  form.addEventListener("change", () => { dirty = true; });

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Name";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.required = true;
  nameInput.value = recipe.name;
  nameLabel.appendChild(nameInput);
  form.appendChild(nameLabel);

  const imageLabel = document.createElement("label");
  imageLabel.textContent = "Image URL (optional)";
  const imageInput = document.createElement("input");
  imageInput.type = "text";
  imageInput.value = recipe.image || "";
  imageLabel.appendChild(imageInput);
  form.appendChild(imageLabel);

  if (recipe.sourceUrl) {
    const refreshRow = document.createElement("div");
    const refreshButton = document.createElement("button");
    refreshButton.type = "button";
    refreshButton.className = "pick-button";
    refreshButton.textContent = "Refresh from source";
    const refreshStatus = document.createElement("span");
    refreshStatus.className = "note-inline";
    refreshButton.addEventListener("click", async () => {
      if (dirty && !confirm("Refreshing replaces the edits currently in this form. Continue?")) return;
      refreshButton.disabled = true;
      refreshStatus.textContent = " Fetching…";
      try {
        const fresh = await scrapeRecipeUrl(recipe.sourceUrl);
        refreshStatus.textContent = ` Current: ${nameInput.value} (${parseIngredientsRaw(ingredientsTextarea.value).length} ingredients). Source preview: ${fresh.name} (${fresh.ingredientsParsed.length} ingredients, ${fresh.directions.length} steps). Review the fields below before saving.`;
        nameInput.value = fresh.name;
        imageInput.value = fresh.image || "";
        servingsInput.value = fresh.servings || "";
        timeInput.value = fresh.totalTimeMinutes || "";
        ingredientsTextarea.value = fresh.ingredientsRaw;
        directionsTextarea.value = fresh.directions.join("\n");
        refreshStatus.textContent = " Pulled the latest from the source page — review below, then Save.";
      } catch (err) {
        refreshStatus.textContent = ` Couldn't refresh: ${err.message}`;
      } finally {
        refreshButton.disabled = false;
      }
    });
    refreshRow.appendChild(refreshButton);
    refreshRow.appendChild(refreshStatus);
    form.appendChild(refreshRow);
  }

  const servingsLabel = document.createElement("label");
  servingsLabel.textContent = "Servings";
  const servingsInput = document.createElement("input");
  servingsInput.type = "number";
  servingsInput.min = "1";
  servingsInput.value = recipe.servings || "";
  servingsLabel.appendChild(servingsInput);
  form.appendChild(servingsLabel);

  const timeLabel = document.createElement("label");
  timeLabel.textContent = "Cook time (minutes)";
  const timeInput = document.createElement("input");
  timeInput.type = "number";
  timeInput.min = "1";
  timeInput.value = recipe.totalTimeMinutes || "";
  timeLabel.appendChild(timeInput);
  form.appendChild(timeLabel);

  const proteinSelect = document.createElement("select");
  const autoProtein = document.createElement("option"); autoProtein.value = ""; autoProtein.textContent = `Automatic (${deriveProteinTag(recipe)})`; proteinSelect.appendChild(autoProtein);
  for (const tag of PROTEIN_TAG_OPTIONS) { const option = document.createElement("option"); option.value = tag; option.textContent = tag; proteinSelect.appendChild(option); }
  proteinSelect.value = recipe.proteinTag || "";
  const proteinLabel = document.createElement("label"); proteinLabel.textContent = "Protein / diet tag"; proteinLabel.appendChild(proteinSelect); form.appendChild(proteinLabel);

  const ingredientsLabel = document.createElement("label");
  ingredientsLabel.textContent = "Ingredients (one per line)";
  const ingredientsTextarea = document.createElement("textarea");
  ingredientsTextarea.rows = 10;
  ingredientsTextarea.value = recipe.ingredientsRaw || "";
  ingredientsLabel.appendChild(ingredientsTextarea);
  form.appendChild(ingredientsLabel);

  const directionsLabel = document.createElement("label");
  directionsLabel.textContent = "Steps (one per line)";
  const directionsTextarea = document.createElement("textarea");
  directionsTextarea.rows = 10;
  directionsTextarea.value = (recipe.directions || []).join("\n");
  directionsLabel.appendChild(directionsTextarea);
  form.appendChild(directionsLabel);

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "pick-button";
  saveButton.textContent = "Save changes";
  form.appendChild(saveButton);
  const saveStatus = document.createElement("p"); saveStatus.setAttribute("role", "status"); form.appendChild(saveStatus);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    const ingredientsRaw = ingredientsTextarea.value;
    try { await updateRecipe(db, recipe.uid, {
      name: nameInput.value.trim(),
      image: imageInput.value.trim() || null,
      servings: servingsInput.value ? Number(servingsInput.value) : null,
      totalTimeMinutes: timeInput.value ? Number(timeInput.value) : null,
      ingredientsRaw,
      ingredientsParsed: parseIngredientsRaw(ingredientsRaw),
      directions: directionsTextarea.value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
      proteinTag: proteinSelect.value || null,
    });
    dirty = false;
    await refresh();
    goBack();
    } catch (err) { saveStatus.textContent = `Couldn't save changes: ${err.message}. Your edits are still here; try again.`; saveButton.disabled = false; saveButton.textContent = "Retry save"; }
  });

  container.appendChild(form);

  const skipButton = document.createElement("button");
  skipButton.type = "button";
  skipButton.className = "pick-button";
  skipButton.style.marginTop = "1.2rem";
  skipButton.textContent = recipe.skipped ? "Include in rotation again" : "Skip for now";
  const skipNote = document.createElement("p");
  skipNote.className = "note-inline";
  skipNote.textContent = recipe.skipped
    ? "This recipe is currently excluded from Shuffle and weekly suggestions. It's still visible here and pickable via \"Pick from all recipes.\""
    : "Keeps the recipe in your list, but out of Shuffle and weekly suggestions until you turn this back on.";
  skipButton.addEventListener("click", async () => {
    if (dirty) { skipNote.textContent = "Save or cancel recipe edits before changing whether it appears in suggestions."; return; }
    skipButton.disabled = true;
    try { await updateRecipe(db, recipe.uid, { skipped: !recipe.skipped }); await refresh(); }
    catch (err) { skipNote.textContent = `Couldn't save: ${err.message}. Try again.`; skipButton.disabled = false; }
  });
  container.appendChild(skipButton);
  container.appendChild(skipNote);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "pick-button danger";
  deleteButton.style.marginTop = "1.2rem";
  deleteButton.textContent = "Delete recipe";
  deleteButton.addEventListener("click", async () => {
    if (dirty) { saveStatus.textContent = "Save or cancel recipe edits before deleting this recipe."; return; }
    if (!confirm(`Delete "${recipe.name}" from the rotation? This can't be undone.`)) return;
    deleteButton.disabled = true;
    try {
      await deleteRecipe(db, recipe.uid);
      dirty = false;
      await refresh();
      // The recipe is gone, so never send them back to its own detail view.
      navigate(params.from === "detail" ? params.detailFrom || "menu" : params.from || "addRecipe");
    } catch (err) { deleteButton.disabled = false; saveStatus.textContent = `Couldn't delete recipe: ${err.message}. Try again.`; }
  });
  container.appendChild(deleteButton);
}
