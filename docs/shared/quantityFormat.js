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

export function formatQuantityLine(name, quantity, unit) {
  const rounded = Math.round(quantity * 100) / 100;
  // "unit" is HelloFresh's placeholder for "whole item, no real measurement" — the
  // word itself adds nothing for shopping ("2 unit Onion"), so it's omitted.
  if (!unit || unit === "unit") return `${rounded} ${name}`;
  const displayUnit = rounded !== 1 ? PLURAL_UNITS[unit] || unit : unit;
  return `${rounded} ${displayUnit} ${name}`;
}
