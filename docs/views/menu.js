import { saveWeekState } from "../firestore.js";

export function renderMenu(container, ctx, refresh) {
  const { weekState, recipesByUid, currentWeekKey, db } = ctx;
  let selected = weekState.picks.slice();

  const heading = document.createElement("p");
  heading.textContent = `Week of ${currentWeekKey} — pick 2 for this week's cooking.`;
  container.appendChild(heading);

  if (weekState.autoPickedIds.length > 0) {
    const notice = document.createElement("div");
    notice.className = "notice";
    notice.textContent = "The deadline passed, so some picks were made automatically. You can still change them below.";
    container.appendChild(notice);
  }

  const list = document.createElement("div");
  container.appendChild(list);

  const saveButton = document.createElement("button");
  saveButton.textContent = "Save picks";
  saveButton.className = "pick-button";
  saveButton.style.marginTop = "1rem";
  container.appendChild(saveButton);

  function renderList() {
    list.innerHTML = "";
    for (const uid of weekState.candidates) {
      const recipe = recipesByUid[uid];
      if (!recipe) continue;

      const card = document.createElement("div");
      card.className = "recipe-card" + (selected.includes(uid) ? " picked" : "");

      const info = document.createElement("div");
      const name = document.createElement("div");
      name.textContent = recipe.name;
      info.appendChild(name);
      if (weekState.autoPickedIds.includes(uid) && weekState.picks.includes(uid)) {
        const badge = document.createElement("div");
        badge.className = "badge";
        badge.textContent = "auto-picked";
        info.appendChild(badge);
      }
      card.appendChild(info);

      const button = document.createElement("button");
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
    await saveWeekState(db, currentWeekKey, { picks: selected, autoPickedIds: [] });
    await refresh();
  });

  renderList();
}
