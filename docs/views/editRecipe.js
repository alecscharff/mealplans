import { updateRecipe, deleteRecipe } from "../firestore.js";
import { parseIngredientsRaw } from "../shared/ingredientParser.js";
import { scrapeRecipeUrl } from "../functionsClient.js";

export function renderEditRecipe(container, ctx, refresh) {
  const { recipesByUid, db, navigate, params } = ctx;
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
      navigate("detail", { uid: recipe.uid, from: params.detailFrom || "menu" });
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
      refreshButton.disabled = true;
      refreshStatus.textContent = " Fetching…";
      try {
        const fresh = await scrapeRecipeUrl(recipe.sourceUrl);
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    const ingredientsRaw = ingredientsTextarea.value;
    await updateRecipe(db, recipe.uid, {
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
    });
    await refresh();
    goBack();
  });

  container.appendChild(form);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "pick-button danger";
  deleteButton.style.marginTop = "1.2rem";
  deleteButton.textContent = "Delete recipe";
  deleteButton.addEventListener("click", async () => {
    if (!confirm(`Delete "${recipe.name}" from the rotation? This can't be undone.`)) return;
    await deleteRecipe(db, recipe.uid);
    await refresh();
    // The recipe is gone, so never send them back to its own detail view — go to
    // wherever the user would have landed one step further back instead.
    navigate(params.from === "detail" ? params.detailFrom || "menu" : params.from || "addRecipe");
  });
  container.appendChild(deleteButton);
}
