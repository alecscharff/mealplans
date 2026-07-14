import { buildGroceryList } from "../shared/grocery.js";
import { saveWeekState } from "../firestore.js";
import { createRecipeThumb } from "./recipeImage.js";

function itemKey(category, item) {
  return `${category}::${item.name}::${item.unit || ""}`;
}

function formatQuantity(item) {
  if (item.quantity == null) return item.raw;
  const rounded = Math.round(item.quantity * 100) / 100;
  return `${rounded}${item.unit ? " " + item.unit : ""} ${item.name}`;
}

export function renderGrocery(container, ctx, refresh) {
  const { weekState, recipesByUid, settings, currentWeekKey, db, navigate } = ctx;

  if (weekState.picks.length < 2) {
    const notice = document.createElement("div");
    notice.className = "notice";
    notice.textContent = "Pick 2 recipes on the This Week tab to generate a grocery list.";
    container.appendChild(notice);
    return;
  }

  const pickedRecipes = weekState.picks.map((uid) => recipesByUid[uid]).filter(Boolean);

  const recipesHeading = document.createElement("h3");
  recipesHeading.textContent = "This week's recipes";
  container.appendChild(recipesHeading);
  const recipesList = document.createElement("div");
  recipesList.className = "recipe-chip-row";
  for (const recipe of pickedRecipes) {
    const chip = document.createElement("div");
    chip.className = "recipe-chip";
    chip.appendChild(createRecipeThumb(recipe, "recipe-thumb-sm"));

    const link = document.createElement("button");
    link.type = "button";
    link.className = "recipe-name-link";
    link.textContent = recipe.name;
    link.addEventListener("click", () => navigate("detail", { uid: recipe.uid, from: "grocery" }));
    chip.appendChild(link);

    recipesList.appendChild(chip);
  }
  container.appendChild(recipesList);

  const grouped = buildGroceryList(pickedRecipes, settings.familySize);
  const checks = { ...weekState.groceryChecks };

  for (const [category, items] of Object.entries(grouped)) {
    const section = document.createElement("div");
    section.className = "grocery-category";

    const heading = document.createElement("h3");
    heading.textContent = category;
    section.appendChild(heading);

    for (const item of items) {
      const key = itemKey(category, item);
      const row = document.createElement("div");
      row.className = "grocery-item" + (checks[key] ? " checked" : "");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = key;
      checkbox.checked = !!checks[key];

      const label = document.createElement("label");
      label.htmlFor = key;
      label.textContent = item.recipeName
        ? `${item.raw} (${item.recipeName})`
        : formatQuantity(item);

      checkbox.addEventListener("change", async () => {
        checks[key] = checkbox.checked;
        row.classList.toggle("checked", checkbox.checked);
        await saveWeekState(db, currentWeekKey, { groceryChecks: checks });
      });

      row.appendChild(checkbox);
      row.appendChild(label);
      section.appendChild(row);
    }

    container.appendChild(section);
  }
}
