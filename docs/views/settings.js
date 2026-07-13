import { saveSettings } from "../firestore.js";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function daySelect(id, value) {
  const select = document.createElement("select");
  select.id = id;
  WEEKDAYS.forEach((label, i) => {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = label;
    option.selected = i === value;
    select.appendChild(option);
  });
  return select;
}

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

  const cookDay1Label = document.createElement("label");
  cookDay1Label.textContent = "First cook day";
  const cookDay1Select = daySelect("cookDay1", settings.cookDay1);
  cookDay1Label.appendChild(cookDay1Select);
  form.appendChild(cookDay1Label);

  const cookDay2Label = document.createElement("label");
  cookDay2Label.textContent = "Second cook day";
  const cookDay2Select = daySelect("cookDay2", settings.cookDay2);
  cookDay2Label.appendChild(cookDay2Select);
  form.appendChild(cookDay2Label);

  const deadlineLabel = document.createElement("label");
  deadlineLabel.textContent = "Auto-pick deadline day";
  const deadlineSelect = daySelect("deadlineDay", settings.deadlineDay);
  deadlineLabel.appendChild(deadlineSelect);
  form.appendChild(deadlineLabel);

  const categoryLabel = document.createElement("label");
  categoryLabel.textContent = "Paprika category ID (set by the sync function's config)";
  const categoryInput = document.createElement("input");
  categoryInput.type = "text";
  categoryInput.value = settings.paprikaCategoryId || "";
  categoryLabel.appendChild(categoryInput);
  form.appendChild(categoryLabel);

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
      cookDay1: Number(cookDay1Select.value),
      cookDay2: Number(cookDay2Select.value),
      deadlineDay: Number(deadlineSelect.value),
      paprikaCategoryId: categoryInput.value.trim(),
    });
    await refresh();
  });

  container.appendChild(form);
}
