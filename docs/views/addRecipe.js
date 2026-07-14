import { scrapeRecipeUrl } from "../functionsClient.js";
import { addRecipe, updateRecipe, deleteRecipe } from "../firestore.js";
import { createRecipeThumb } from "./recipeImage.js";
import { appendBoldMarkedText } from "./boldText.js";

export function renderAddRecipe(container, ctx, refresh) {
  const { db, recipeCache, navigate } = ctx;
  let scraped = null;

  const form = document.createElement("form");
  form.className = "settings-form";

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

    const name = document.createElement("h3");
    name.textContent = scraped.name;
    card.appendChild(name);

    if (scraped.servings || scraped.totalTimeMinutes) {
      const meta = document.createElement("p");
      meta.textContent = [
        scraped.servings ? `Serves ${scraped.servings}` : null,
        scraped.totalTimeMinutes ? `${scraped.totalTimeMinutes} min` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      card.appendChild(meta);
    }

    const ingredientsHeading = document.createElement("h4");
    ingredientsHeading.textContent = "Ingredients";
    card.appendChild(ingredientsHeading);
    const ingredientsList = document.createElement("ul");
    for (const item of scraped.ingredientsParsed) {
      const li = document.createElement("li");
      li.textContent = item.raw;
      ingredientsList.appendChild(li);
    }
    card.appendChild(ingredientsList);

    const stepsHeading = document.createElement("h4");
    stepsHeading.textContent = "Steps";
    card.appendChild(stepsHeading);
    const stepsList = document.createElement("ol");
    for (const step of scraped.directions) {
      const li = document.createElement("li");
      appendBoldMarkedText(li, step);
      stepsList.appendChild(li);
    }
    card.appendChild(stepsList);

    const existing = recipeCache.recipes.find((r) => r.sourceUrl === scraped.sourceUrl);

    const saveButton = document.createElement("button");
    saveButton.className = "pick-button";
    saveButton.textContent = existing ? "Update existing recipe" : "Add to menu rotation";
    saveButton.addEventListener("click", async () => {
      saveButton.disabled = true;
      saveButton.textContent = "Saving…";
      const fields = {
        name: scraped.name,
        sourceUrl: scraped.sourceUrl,
        servings: scraped.servings,
        image: scraped.image,
        totalTimeMinutes: scraped.totalTimeMinutes,
        ingredientsRaw: scraped.ingredientsRaw,
        ingredientsParsed: scraped.ingredientsParsed,
        directions: scraped.directions,
      };
      if (existing) {
        await updateRecipe(db, existing.uid, fields);
      } else {
        await addRecipe(db, { uid: crypto.randomUUID(), ...fields, lastCooked: null, addedAt: new Date().toISOString() });
      }
      urlInput.value = "";
      scraped = null;
      await refresh();
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
  } else {
    const list = document.createElement("div");
    list.className = "recipe-chip-row";
    for (const recipe of recipeCache.recipes) {
      const chip = document.createElement("div");
      chip.className = "recipe-chip";
      chip.appendChild(createRecipeThumb(recipe, "recipe-thumb-sm"));

      const link = document.createElement("button");
      link.type = "button";
      link.className = "recipe-name-link";
      link.textContent = recipe.name;
      link.addEventListener("click", () => navigate("editRecipe", { uid: recipe.uid, from: "addRecipe" }));
      chip.appendChild(link);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "chip-delete";
      deleteButton.textContent = "×";
      deleteButton.setAttribute("aria-label", `Remove ${recipe.name}`);
      deleteButton.addEventListener("click", async () => {
        if (!confirm(`Remove "${recipe.name}" from the rotation?`)) return;
        await deleteRecipe(db, recipe.uid);
        await refresh();
      });
      chip.appendChild(deleteButton);

      list.appendChild(chip);
    }
    container.appendChild(list);
  }
}
