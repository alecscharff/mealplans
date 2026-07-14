import { saveWeekState } from "../firestore.js";
import { generateCandidates } from "../shared/candidates.js";
import { deriveTags } from "../shared/recipeTags.js";
import { createRecipeThumb } from "./recipeImage.js";
import { formatWeekLabel } from "./weekLabel.js";

const CANDIDATES_PER_WEEK = 4;

function candidateSeed(settings, shuffleNonce) {
  return `${settings.shuffleSeed || "sunday-menu"}:${shuffleNonce || 0}`;
}

export function renderMenu(container, ctx, refresh) {
  const { upcomingWeeks, recipesByUid, recipeCache, settings, db, navigate } = ctx;

  for (const { weekKey, weekState } of upcomingWeeks) {
    container.appendChild(
      renderWeekSection({ weekKey, weekState, upcomingWeeks, recipesByUid, recipeCache, settings, db, navigate, refresh })
    );
  }
}

function renderWeekSection({ weekKey, weekState, upcomingWeeks, recipesByUid, recipeCache, settings, db, navigate, refresh }) {
  const section = document.createElement("section");
  section.className = "week-section";

  const headerRow = document.createElement("div");
  headerRow.className = "week-header";
  const heading = document.createElement("h3");
  heading.textContent = formatWeekLabel(weekKey);
  headerRow.appendChild(heading);

  const shuffleButton = document.createElement("button");
  shuffleButton.type = "button";
  shuffleButton.className = "pick-button shuffle-button";
  shuffleButton.textContent = "Shuffle";
  headerRow.appendChild(shuffleButton);
  section.appendChild(headerRow);

  const list = document.createElement("div");
  section.appendChild(list);

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Save picks";
  saveButton.className = "pick-button";
  section.appendChild(saveButton);

  // Two picks are always shown as selected — either confirmed picks, or (before a save)
  // the top two candidates as a default suggestion — plus two alternatives to swap in.
  let selected = weekState.picks.length > 0 ? weekState.picks.slice() : weekState.candidates.slice(0, 2);

  function renderList() {
    list.innerHTML = "";
    for (const uid of weekState.candidates) {
      const recipe = recipesByUid[uid];
      if (!recipe) continue;

      const card = document.createElement("div");
      card.className = "recipe-card" + (selected.includes(uid) ? " picked" : "");
      card.appendChild(createRecipeThumb(recipe));

      const info = document.createElement("div");
      info.className = "recipe-card-info";
      const name = document.createElement("button");
      name.type = "button";
      name.className = "recipe-name-link";
      name.textContent = recipe.name;
      name.addEventListener("click", () => navigate("detail", { uid, from: "menu" }));
      info.appendChild(name);

      const meta = document.createElement("div");
      meta.className = "recipe-meta";
      if (recipe.totalTimeMinutes) {
        const time = document.createElement("span");
        time.className = "recipe-time";
        time.textContent = `${recipe.totalTimeMinutes} min`;
        meta.appendChild(time);
      }
      for (const tag of deriveTags(recipe)) {
        const tagEl = document.createElement("span");
        tagEl.className = "recipe-tag";
        tagEl.textContent = tag;
        meta.appendChild(tagEl);
      }
      info.appendChild(meta);

      if (!selected.includes(uid)) {
        const badge = document.createElement("div");
        badge.className = "badge badge-alt";
        badge.textContent = "alternative";
        info.appendChild(badge);
      }
      card.appendChild(info);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "pick-button" + (selected.includes(uid) ? " selected" : "");
      button.textContent = selected.includes(uid) ? "Picked" : "Pick";
      button.disabled = !selected.includes(uid) && selected.length >= 2;
      button.addEventListener("click", () => {
        if (selected.includes(uid)) {
          selected = selected.filter((id) => id !== uid);
        } else if (selected.length < 2) {
          selected = [...selected, uid];
        }
        renderList();
      });
      card.appendChild(button);

      list.appendChild(card);
    }
  }

  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    await saveWeekState(db, weekKey, { picks: selected });
    await refresh();
  });

  shuffleButton.addEventListener("click", async () => {
    shuffleButton.disabled = true;
    shuffleButton.textContent = "Shuffling…";
    // Exclude recipes already showing up in any other displayed week, so a shuffle
    // can't create a duplicate elsewhere in the 4-week view.
    const usedByOtherWeeks = new Set(
      upcomingWeeks.filter((w) => w.weekKey !== weekKey).flatMap((w) => w.weekState.candidates)
    );
    const availableRecipes = recipeCache.recipes.filter((r) => !usedByOtherWeeks.has(r.uid));
    const nextNonce = (weekState.shuffleNonce || 0) + 1;
    const candidates = generateCandidates(availableRecipes, weekKey, candidateSeed(settings, nextNonce), {
      takeCount: CANDIDATES_PER_WEEK,
    });
    await saveWeekState(db, weekKey, { candidates, shuffleNonce: nextNonce, picks: [] });
    await refresh();
  });

  renderList();
  return section;
}
