// HelloFresh's JSON-LD encodes both genuinely discrete whole items (e.g. "1 unit
// Onion") and packaged/canned/jarred goods (e.g. "1 unit Chickpeas", "3 unit Chicken
// Stock Concentrate") with the same generic "unit" placeholder. For a whole onion,
// "1 Onion" is a complete, correct shopping instruction. For canned/pouched goods it
// isn't — "1 Chickpeas" doesn't say what to look for on the shelf. This table maps
// known packaged-goods names to the container you'd actually ask for, so the
// ingredient's unit becomes that noun instead of the uninformative "unit".
//
// This is necessarily a maintained list, not something derivable from HelloFresh's
// page data (it doesn't publish container type). Add new names here as they show up
// in scraped recipes — `node --test docs/shared/*.test.js` will keep passing either
// way; an unmapped name just falls back to the current bare-count behavior.
const PACKAGING_UNITS = {
  "black beans": "can",
  chickpeas: "can",
  "coconut milk": "can",
  "crushed tomatoes": "can",
  "tomato paste": "can",
  "diced tomatoes": "can",
  "chicken stock concentrate": "packet",
  "mushroom stock concentrate": "packet",
  "pho stock concentrate": "packet",
  "veggie stock concentrate": "packet",
  "veggie pho stock concentrate": "packet",
  "beef stock concentrate": "packet",
  "tex-mex paste": "packet",
  tofu: "block",
};

export function packagingUnitFor(ingredientName) {
  return PACKAGING_UNITS[ingredientName.trim().toLowerCase()] || null;
}
