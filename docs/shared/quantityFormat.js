// Shared "N unit Name" display formatting for grocery list and recipe detail views.

// Abbreviated units (cup, tbsp, oz, ...) read fine unpluralized in a shopping list —
// that's the recipe-writing convention. Full-word units don't; "2 clove Garlic" or
// "3 can Chickpeas" reads as a typo, so those get pluralized when quantity isn't 1.
const PLURAL_UNITS = {
  clove: "cloves",
  can: "cans",
  packet: "packets",
  block: "blocks",
  slice: "slices",
  stick: "sticks",
  pinch: "pinches",
  dash: "dashes",
  bunch: "bunches",
  head: "heads",
  stalk: "stalks",
  sprig: "sprigs",
};

// Same formatting as formatQuantityLine, but split into a plain-text quantity/unit
// prefix and the bare ingredient name — lets callers (recipe detail view) render the
// name in bold without re-parsing the combined string back apart.
export function formatQuantityParts(name, quantity, unit) {
  const candidates = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.6666667, 0.75, 0.8333333, 0.875, 1];
  const closest = candidates.reduce((best, n) => Math.abs(n - (quantity % 1)) < Math.abs(best - (quantity % 1)) ? n : best, 0);
  const rounded = Math.abs(closest - (quantity % 1)) <= 0.018 ? Math.floor(quantity) + closest : Math.round(quantity * 100) / 100;
  const whole = Math.floor(rounded);
  const fraction = Math.round((rounded - whole) * 8);
  const fractionText = ({ "0.125": "⅛", "0.25": "¼", "0.375": "⅜", "0.5": "½", "0.625": "⅝", "0.6666667": "⅔", "0.75": "¾", "0.8333333": "⅚", "0.875": "⅞" })[String(Number((rounded - whole).toFixed(7)))] || "";
  const displayQuantity = fractionText ? `${whole || ""}${fractionText}` : String(Number(rounded.toFixed(2)));
  // "unit" is HelloFresh's placeholder for "whole item, no real measurement" — the
  // word itself adds nothing for shopping ("2 unit Onion"), so it's omitted.
  if (!unit || unit === "unit") return { prefix: `${displayQuantity} `, name };
  const displayUnit = rounded !== 1 ? PLURAL_UNITS[unit] || unit : unit;
  return { prefix: `${displayQuantity} ${displayUnit} `, name };
}

export function formatQuantityLine(name, quantity, unit) {
  const { prefix, name: displayName } = formatQuantityParts(name, quantity, unit);
  return `${prefix}${displayName}`;
}
