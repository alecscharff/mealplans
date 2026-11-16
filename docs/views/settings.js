import { sendMenuTestEmail } from "../functionsClient.js";
import { dismissMenuSuggestion, getMenuSuggestions, saveSettings } from "../firestore.js";
import { emailMode } from "../shared/menuEmail.js";

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

  const emailLabel = document.createElement("label");
  emailLabel.textContent = "Meal plan emails";
  const emailSelect = document.createElement("select");
  for (const [value, label] of [
    ["off", "Off"],
    ["weekly", "Weekly email"],
    ["replies", "Weekly email + reply handling"],
  ]) {
    emailSelect.add(new Option(label, value));
  }
  emailSelect.value = emailMode(settings);
  emailLabel.append(emailSelect);
  form.append(emailLabel);

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
      const changes = { familySize: size };
      if (emailSelect.value !== emailMode(settings)) changes.emailMode = emailSelect.value;
      await saveSettings(db, changes);
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

  const testButton = document.createElement("button");
  testButton.type = "button";
  testButton.className = "pick-button";
  testButton.textContent = "Send me a test email";
  const testStatus = document.createElement("p");
  testStatus.setAttribute("role", "status");
  testButton.onclick = async () => {
    testButton.disabled = true;
    testStatus.textContent = "Sending…";
    try {
      const { email } = await sendMenuTestEmail();
      testStatus.textContent = `Test email accepted for ${email}. Check your inbox.`;
    } catch (error) {
      testStatus.textContent = `Couldn't send the test email. ${error.message}`;
    } finally {
      testButton.disabled = false;
    }
  };
  container.append(testButton, testStatus);
  const suggestions = document.createElement("section");
  container.append(suggestions);
  renderSuggestions(suggestions, db);

}


async function renderSuggestions(container, db) {
  try {
    const entries = await getMenuSuggestions(db);
    if (entries.length === 0) return;
    const heading = document.createElement("h3");
    heading.textContent = "Recipe ideas from email";
    container.append(heading);
    const list = document.createElement("ul");
    for (const { id, url, week } of entries) {
      const row = document.createElement("li");
      const link = document.createElement("a");
      link.textContent = url;
      if (/^https?:\/\//i.test(url)) {
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.textContent = "Dismiss";
      dismiss.onclick = async () => {
        dismiss.disabled = true;
        try {
          await dismissMenuSuggestion(db, id);
          row.remove();
          if (!list.children.length) container.replaceChildren();
        } catch {
          dismiss.disabled = false;
          status.textContent = "Could not dismiss that recipe idea. Try again.";
        }
      };
      const status = document.createElement("span");
      status.setAttribute("role", "status");
      row.append(`Week of ${week} · `, link, " ", dismiss, " ", status);
      list.append(row);
    }
    container.append(list);
  } catch {
    container.textContent = "Could not load recipe ideas.";
  }
}
