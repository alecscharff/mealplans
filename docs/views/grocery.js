import { buildGroceryList } from "../shared/grocery.js";
import { saveWeekState } from "../firestore.js";
import { createRecipeThumb } from "./recipeImage.js";
import { createSpiceBlendNote } from "./spiceBlendNote.js";
import { formatWeekLabel } from "./weekLabel.js";
import { formatQuantityLine } from "../shared/quantityFormat.js";

function itemKey(category, item) {
  return `${category}::${item.name}::${item.unit || ""}`;
}

function formatQuantity(item) {
  if (item.quantity == null) return item.raw;
  return formatQuantityLine(item.name, item.quantity, item.unit);
}

export function renderGrocery(container, ctx, refresh) {
  const { upcomingWeeks, currentWeekKey, recipesByUid, settings, db, navigate } = ctx;

  let weekIndex = upcomingWeeks.findIndex((w) => w.weekKey === currentWeekKey);
  if (weekIndex < 0) weekIndex = 0;

  const nav = document.createElement("div");
  nav.className = "week-nav";
  const prevButton = document.createElement("button");
  prevButton.type = "button";
  prevButton.className = "pick-button";
  prevButton.textContent = "← Previous week";
  const weekLabel = document.createElement("h3");
  weekLabel.className = "week-nav-label";
  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "pick-button";
  nextButton.textContent = "Next week →";
  nav.appendChild(prevButton);
  nav.appendChild(weekLabel);
  nav.appendChild(nextButton);
  container.appendChild(nav);

  const body = document.createElement("div");
  container.appendChild(body);

  function renderBody() {
    body.innerHTML = "";
    prevButton.disabled = weekIndex <= 0;
    nextButton.disabled = weekIndex >= upcomingWeeks.length - 1;

    const { weekKey, weekState } = upcomingWeeks[weekIndex];
    weekLabel.textContent = formatWeekLabel(weekKey);

    if (weekState.picks.length < 2) {
      const notice = document.createElement("div");
      notice.className = "notice";
      notice.textContent = "Pick 2 recipes for this week on the Menu tab to generate its grocery list.";
      body.appendChild(notice);
      return;
    }

    const pickedRecipes = weekState.picks.map((uid) => recipesByUid[uid]).filter(Boolean);

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
    body.appendChild(recipesList);

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

        const main = document.createElement("div");
        main.className = "grocery-item-main";

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
          await saveWeekState(db, weekKey, { groceryChecks: checks });
        });

        main.appendChild(checkbox);
        main.appendChild(label);
        row.appendChild(main);

        const blendNote = createSpiceBlendNote(item.name);
        if (blendNote) row.appendChild(blendNote);

        section.appendChild(row);
      }

      body.appendChild(section);
    }
  }

  prevButton.addEventListener("click", () => {
    weekIndex--;
    renderBody();
  });
  nextButton.addEventListener("click", () => {
    weekIndex++;
    renderBody();
  });

  renderBody();
}
