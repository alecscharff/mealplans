import { saveWeekState } from "../firestore.js";
import { createRecipeThumb } from "./recipeImage.js";
import { createSpiceBlendNote } from "./spiceBlendNote.js";
import { appendBoldMarkedText } from "./boldText.js";
import { formatQuantityParts } from "../shared/quantityFormat.js";
import { splitStepIntoLines } from "../shared/stepLines.js";

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

  // recipeServings is what the ingredient quantities are actually written for (the
  // scaling denominator — same "assumed 4 servings" fallback buildGroceryList uses
  // for a recipe with no published yield). The servings field should default to
  // familySize so the list is already scaled to the household on open, matching the
  // grocery list's behavior — not to recipeServings, which would show a scale of 1
  // (the recipe's original, unscaled quantities) whenever the two numbers differ.
  const recipeServings = recipe.servings || 4;
  const initialServings = settings.familySize || recipeServings;

  const servingsLabel = document.createElement("label");
  servingsLabel.className = "servings-label";
  servingsLabel.textContent = "Servings ";
  const servingsInput = document.createElement("input");
  servingsInput.type = "number";
  servingsInput.min = "1";
  servingsInput.value = initialServings;
  servingsLabel.appendChild(servingsInput);
  container.appendChild(servingsLabel);

  const ingredientsHeading = document.createElement("h3");
  ingredientsHeading.textContent = "Ingredients";
  container.appendChild(ingredientsHeading);
  const ingredientsList = document.createElement("ul");
  container.appendChild(ingredientsList);

  function renderIngredients() {
    ingredientsList.innerHTML = "";
    const scale = Number(servingsInput.value || initialServings) / recipeServings;
    for (const item of recipe.ingredientsParsed) {
      const li = document.createElement("li");
      if (item.quantity == null) {
        li.textContent = item.raw;
      } else {
        const { prefix, name: ingredientName } = formatQuantityParts(item.name, item.quantity * scale, item.unit);
        li.appendChild(document.createTextNode(prefix));
        const strong = document.createElement("strong");
        strong.textContent = ingredientName;
        li.appendChild(strong);
      }
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

  // Each instruction step often bundles a few discrete actions into one run-on
  // sentence — split those into individual lines so they can be crossed off one at a
  // time while cooking, instead of the whole step disappearing at once.
  const lines = recipe.directions.flatMap((step) => splitStepIntoLines(step));

  const stepChecks = { ...(weekState.stepChecks?.[recipe.uid] || {}) };
  const stepsList = document.createElement("ol");
  stepsList.className = "step-list";
  lines.forEach((line, i) => {
    const li = document.createElement("li");
    li.className = "step-item" + (stepChecks[i] ? " checked" : "");
    // .step-item is display:flex (for the ::before step-number counter alongside the
    // text). Bold-marked text is several sibling nodes (text nodes + <strong>s) — if
    // appended straight onto the flex container, each one becomes its own flex item
    // and gets squeezed into its own narrow column instead of flowing as one
    // paragraph. Wrapping them in a single span makes that span the one flex item;
    // its own children lay out as normal inline text.
    const textEl = document.createElement("span");
    textEl.className = "step-text";
    appendBoldMarkedText(textEl, line);
    li.appendChild(textEl);
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
