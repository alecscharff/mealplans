import { saveWeekState } from "../firestore.js";
import { createRecipeThumb } from "./recipeImage.js";
import { createSpiceBlendNote } from "./spiceBlendNote.js";

function formatScaledQuantity(item, scale) {
  if (item.quantity == null) return item.raw;
  const rounded = Math.round(item.quantity * scale * 100) / 100;
  return `${rounded}${item.unit ? " " + item.unit : ""} ${item.name}`;
}

export function renderRecipeDetail(container, ctx, refresh) {
  const { recipesByUid, weekState, currentWeekKey, settings, db, navigate, params } = ctx;
  const recipe = recipesByUid[params.uid];

  if (!recipe) {
    const notice = document.createElement("div");
    notice.className = "notice";
    notice.textContent = "Recipe not found.";
    container.appendChild(notice);
    return;
  }

  const toolbar = document.createElement("div");
  toolbar.className = "detail-toolbar";

  const backButton = document.createElement("button");
  backButton.className = "pick-button";
  backButton.textContent = "← Back";
  backButton.addEventListener("click", () => navigate(params.from || "menu"));
  toolbar.appendChild(backButton);

  const editButton = document.createElement("button");
  editButton.className = "pick-button";
  editButton.textContent = "Edit";
  editButton.addEventListener("click", () =>
    navigate("editRecipe", { uid: recipe.uid, from: "detail", detailFrom: params.from })
  );
  toolbar.appendChild(editButton);

  container.appendChild(toolbar);

  container.appendChild(createRecipeThumb(recipe, "recipe-thumb-hero"));

  const name = document.createElement("h2");
  name.textContent = recipe.name;
  container.appendChild(name);

  if (recipe.sourceUrl) {
    const link = document.createElement("a");
    link.className = "source-link";
    link.href = recipe.sourceUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    let hostname = recipe.sourceUrl;
    try {
      hostname = new URL(recipe.sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      // Keep the raw URL as a fallback if it's somehow not a valid URL.
    }
    link.textContent = `Source: ${hostname} ↗`;
    container.appendChild(link);
  }

  const baseServings = recipe.servings || settings.familySize || 4;

  const servingsLabel = document.createElement("label");
  servingsLabel.className = "servings-label";
  servingsLabel.textContent = "Servings ";
  const servingsInput = document.createElement("input");
  servingsInput.type = "number";
  servingsInput.min = "1";
  servingsInput.value = baseServings;
  servingsLabel.appendChild(servingsInput);
  container.appendChild(servingsLabel);

  const ingredientsHeading = document.createElement("h3");
  ingredientsHeading.textContent = "Ingredients";
  container.appendChild(ingredientsHeading);
  const ingredientsList = document.createElement("ul");
  container.appendChild(ingredientsList);

  function renderIngredients() {
    ingredientsList.innerHTML = "";
    const scale = Number(servingsInput.value || baseServings) / baseServings;
    for (const item of recipe.ingredientsParsed) {
      const li = document.createElement("li");
      li.textContent = formatScaledQuantity(item, scale);
      const blendNote = createSpiceBlendNote(item.name);
      if (blendNote) li.appendChild(blendNote);
      ingredientsList.appendChild(li);
    }
  }
  servingsInput.addEventListener("input", renderIngredients);
  renderIngredients();

  const stepsHeading = document.createElement("h3");
  stepsHeading.textContent = "Steps";
  container.appendChild(stepsHeading);

  const stepChecks = { ...(weekState.stepChecks?.[recipe.uid] || {}) };
  const stepsList = document.createElement("ol");
  stepsList.className = "step-list";
  recipe.directions.forEach((step, i) => {
    const li = document.createElement("li");
    li.className = "step-item" + (stepChecks[i] ? " checked" : "");
    li.textContent = step;
    li.addEventListener("click", async () => {
      stepChecks[i] = !stepChecks[i];
      li.classList.toggle("checked", stepChecks[i]);
      await saveWeekState(db, currentWeekKey, {
        stepChecks: { ...weekState.stepChecks, [recipe.uid]: stepChecks },
      });
    });
    stepsList.appendChild(li);
  });
  container.appendChild(stepsList);
}
