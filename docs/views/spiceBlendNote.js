import { findSpiceBlend } from "../shared/hellofreshSpiceBlends.js";

// Returns a small <details> disclosure with the mix-your-own recipe when an ingredient
// text matches a known HelloFresh proprietary blend, or null otherwise.
export function createSpiceBlendNote(ingredientText) {
  const blend = findSpiceBlend(ingredientText);
  if (!blend) return null;

  const details = document.createElement("details");
  details.className = "spice-blend-note";

  const summary = document.createElement("summary");
  summary.textContent = "HelloFresh blend — mix your own";
  details.appendChild(summary);

  const list = document.createElement("ul");
  for (const line of blend.lines) {
    const li = document.createElement("li");
    li.textContent = line;
    list.appendChild(li);
  }
  details.appendChild(list);

  return details;
}
