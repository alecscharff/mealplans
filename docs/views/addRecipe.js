import { scrapeRecipeUrl } from "../functionsClient.js";
import { addRecipe } from "../firestore.js";

export function renderAddRecipe(container, ctx, refresh) {
  const { db, recipeCache } = ctx;
  let scraped = null;

  const form = document.createElement("form");
  form.className = "settings-form";

  const urlLabel = document.createElement("label");
  urlLabel.textContent = "Recipe URL";
  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.required = true;
  urlInput.placeholder = "https://example.com/some-recipe";
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
    card.style.flexDirection = "column";
    card.style.alignItems = "stretch";

    const name = document.createElement("h3");
    name.textContent = scraped.name;
    card.appendChild(name);

    if (scraped.servings) {
      const servings = document.createElement("p");
      servings.textContent = `Serves ${scraped.servings}`;
      card.appendChild(servings);
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
      li.textContent = step;
      stepsList.appendChild(li);
    }
    card.appendChild(stepsList);

    const saveButton = document.createElement("button");
    saveButton.className = "pick-button";
    saveButton.textContent = "Add to menu rotation";
    saveButton.addEventListener("click", async () => {
      saveButton.disabled = true;
      saveButton.textContent = "Saving…";
      const recipe = {
        uid: crypto.randomUUID(),
        name: scraped.name,
        sourceUrl: scraped.sourceUrl,
        servings: scraped.servings,
        ingredientsRaw: scraped.ingredientsRaw,
        ingredientsParsed: scraped.ingredientsParsed,
        directions: scraped.directions,
        lastCooked: null,
        addedAt: new Date().toISOString(),
      };
      await addRecipe(db, recipe);
      urlInput.value = "";
      scraped = null;
      await refresh();
    });
    card.appendChild(saveButton);

    preview.appendChild(card);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    scraped = null;
    preview.innerHTML = "";
    fetchButton.disabled = true;
    statusEl.textContent = "Fetching…";
    try {
      scraped = await scrapeRecipeUrl(urlInput.value.trim());
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
    const list = document.createElement("ul");
    for (const recipe of recipeCache.recipes) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = recipe.sourceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = recipe.name;
      li.appendChild(link);
      list.appendChild(li);
    }
    container.appendChild(list);
  }
}
