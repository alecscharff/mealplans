import { saveSettings } from "../firestore.js";

export function renderSettings(container, ctx, refresh) {
  const { settings, db } = ctx;

  const form = document.createElement("form");
  form.className = "settings-form";

  const familySizeLabel = document.createElement("label");
  familySizeLabel.textContent = "Family size";
  const familySizeInput = document.createElement("input");
  familySizeInput.type = "number";
  familySizeInput.min = "1";
  familySizeInput.value = settings.familySize;
  familySizeLabel.appendChild(familySizeInput);
  form.appendChild(familySizeLabel);

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.className = "pick-button";
  saveButton.textContent = "Save settings";
  form.appendChild(saveButton);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    await saveSettings(db, {
      familySize: Number(familySizeInput.value),
    });
    await refresh();
  });

  container.appendChild(form);
}
