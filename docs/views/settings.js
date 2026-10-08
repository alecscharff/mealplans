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

  const status = document.createElement("p");
  status.setAttribute("role", "status");
  form.appendChild(status);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const size = Number(familySizeInput.value);
    if (!familySizeInput.value.trim() || !Number.isInteger(size) || size < 1) {
      status.textContent = "Enter a whole number of at least 1. Your current setting is unchanged.";
      familySizeInput.focus();
      return;
    }
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    status.textContent = "";
    try {
      await saveSettings(db, { familySize: size });
      status.textContent = "Settings saved.";
      await refresh();
    } catch (err) {
      status.textContent = `Couldn't save settings: ${err.message}. Your entry is still here; try again.`;
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save settings";
    }
  });

  container.appendChild(form);
}
