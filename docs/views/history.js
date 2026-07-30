import { formatWeekLabel } from "./weekLabel.js";
import { createRecipeThumb } from "./recipeImage.js";

// Past weeks that had picks when they rolled over (see shared/rollover.js +
// firestore.js#getHistory) — lets you look back at what was cooked and reopen those
// recipes, since the Menu/Grocery tabs only ever show the current week plus a few
// ahead and a week disappears from both the moment it rolls over.
export function renderHistory(container, ctx) {
  const { history, recipesByUid, navigate } = ctx;

  if (!history || history.length === 0) {
    const notice = document.createElement("div");
    notice.className = "notice";
    notice.textContent = "No past weeks yet — a completed week shows up here once it rolls over.";
    container.appendChild(notice);
    return;
  }

  for (const entry of history) {
    const section = document.createElement("section");
    section.className = "week-section";

    const heading = document.createElement("h3");
    heading.textContent = formatWeekLabel(entry.weekKey);
    section.appendChild(heading);

    const recipes = entry.recipeUids.map((uid) => recipesByUid[uid]).filter(Boolean);

    if (recipes.length === 0) {
      const note = document.createElement("p");
      note.className = "note-inline";
      note.textContent = "These recipes are no longer in your rotation.";
      section.appendChild(note);
    } else {
      const list = document.createElement("div");
      list.className = "recipe-chip-row";
      for (const recipe of recipes) {
        const chip = document.createElement("div");
        chip.className = "recipe-chip";
        chip.appendChild(createRecipeThumb(recipe, "recipe-thumb-sm"));

        const link = document.createElement("button");
        link.type = "button";
        link.className = "recipe-name-link";
        link.textContent = recipe.name;
        link.addEventListener("click", () => navigate("detail", { uid: recipe.uid, from: "history" }));
        chip.appendChild(link);

        list.appendChild(chip);
      }
      section.appendChild(list);
    }

    container.appendChild(section);
  }
}
