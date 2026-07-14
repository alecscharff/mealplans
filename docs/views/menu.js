import { saveWeekState } from "../firestore.js";
import { generateCandidates } from "../shared/candidates.js";
import { createRecipeThumb } from "./recipeImage.js";

const CANDIDATES_PER_WEEK = 4;

function candidateSeed(settings, shuffleNonce) {
  return `${settings.shuffleSeed || "sunday-menu"}:${shuffleNonce || 0}`;
}

function formatWeekLabel(weekKey, currentWeekKey) {
  if (weekKey === currentWeekKey) return "This Week";
  const [y, m, d] = weekKey.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Week of ${label}`;
}

export function renderMenu(container, ctx, refresh) {
  const { upcomingWeeks, currentWeekKey, recipesByUid, recipeCache, settings, db, navigate } = ctx;

  for (const { weekKey, weekState } of upcomingWeeks) {
    container.appendChild(
      renderWeekSection({ weekKey, weekState, currentWeekKey, recipesByUid, recipeCache, settings, db, navigate, refresh })
    );
  }
}

function renderWeekSection({ weekKey, weekState, currentWeekKey, recipesByUid, recipeCache, settings, db, navigate, refresh }) {
  const section = document.createElement("section");
  section.className = "week-section";

  const headerRow = document.createElement("div");
  headerRow.className = "week-header";
  const heading = document.createElement("h3");
  heading.textContent = formatWeekLabel(weekKey, currentWeekKey);
  headerRow.appendChild(heading);

  const shuffleButton = document.createElement("button");
  shuffleButton.type = "button";
  shuffleButton.className = "pick-button shuffle-button";
  shuffleButton.textContent = "Shuffle";
  headerRow.appendChild(shuffleButton);
  section.appendChild(headerRow);

  if (weekKey === currentWeekKey && weekState.autoPickedIds.length > 0) {
    const notice = document.createElement("div");
    notice.className = "notice";
    notice.textContent = "The deadline passed, so some picks were made automatically. You can still change them below.";
    section.appendChild(notice);
  }

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

      if (weekState.autoPickedIds.includes(uid) && weekState.picks.includes(uid)) {
        const badge = document.createElement("div");
        badge.className = "badge";
        badge.textContent = "auto-picked";
        info.appendChild(badge);
      } else if (!selected.includes(uid)) {
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
    await saveWeekState(db, weekKey, { picks: selected, autoPickedIds: [] });
    await refresh();
  });

  shuffleButton.addEventListener("click", async () => {
    shuffleButton.disabled = true;
    shuffleButton.textContent = "Shuffling…";
    const nextNonce = (weekState.shuffleNonce || 0) + 1;
    const candidates = generateCandidates(recipeCache.recipes, weekKey, candidateSeed(settings, nextNonce), {
      takeCount: CANDIDATES_PER_WEEK,
    });
    await saveWeekState(db, weekKey, { candidates, shuffleNonce: nextNonce, picks: [], autoPickedIds: [] });
    await refresh();
  });

  renderList();
  return section;
}
