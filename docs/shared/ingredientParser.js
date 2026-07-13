// Best-effort regex parser for Paprika's raw newline-separated ingredient lines.
// Turns "2 cups flour" into { quantity: 2, unit: "cup", name: "flour", raw: "2 cups flour" }.
// Lines that don't start with a recognizable quantity (e.g. "Salt and pepper to taste")
// fall back to { quantity: null, unit: null, name: raw, raw } so callers can still
// display them, just without merge/scale support.

const UNICODE_FRACTIONS = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const UNIT_ALIASES = {
  cup: "cup",
  cups: "cup",
  c: "cup",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsp: "tbsp",
  tbsps: "tbsp",
  tbs: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  tsps: "tsp",
  ounce: "oz",
  ounces: "oz",
  oz: "oz",
  pound: "lb",
  pounds: "lb",
  lb: "lb",
  lbs: "lb",
  gram: "g",
  grams: "g",
  g: "g",
  kilogram: "kg",
  kilograms: "kg",
  kg: "kg",
  milliliter: "ml",
  milliliters: "ml",
  ml: "ml",
  liter: "l",
  liters: "l",
  l: "l",
  pint: "pt",
  pints: "pt",
  pt: "pt",
  quart: "qt",
  quarts: "qt",
  qt: "qt",
  gallon: "gal",
  gallons: "gal",
  gal: "gal",
  clove: "clove",
  cloves: "clove",
  can: "can",
  cans: "can",
  package: "pkg",
  packages: "pkg",
  pkg: "pkg",
  slice: "slice",
  slices: "slice",
  stick: "stick",
  sticks: "stick",
  pinch: "pinch",
  pinches: "pinch",
  dash: "dash",
  dashes: "dash",
  bunch: "bunch",
  bunches: "bunch",
  head: "head",
  heads: "head",
  stalk: "stalk",
  stalks: "stalk",
  sprig: "sprig",
  sprigs: "sprig",
};

function normalizeFractions(str) {
  return str.replace(
    /(\d+\s*)?([¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g,
    (_match, whole, frac) => {
      const value = (whole ? parseFloat(whole) : 0) + UNICODE_FRACTIONS[frac];
      return String(value);
    }
  );
}

// Consumes a leading numeric quantity token (mixed number, fraction, decimal, or
// a "3-4" / "3 to 4" range) from the start of `str`. Ranges resolve to their average.
function consumeQuantity(str) {
  const mixed = str.match(/^(\d+)\s+(\d+)\/(\d+)\s*/);
  if (mixed) {
    const value = parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10);
    return { value, rest: str.slice(mixed[0].length) };
  }

  const fraction = str.match(/^(\d+)\/(\d+)\s*/);
  if (fraction) {
    const value = parseInt(fraction[1], 10) / parseInt(fraction[2], 10);
    return { value, rest: str.slice(fraction[0].length) };
  }

  const range = str.match(/^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*/);
  if (range) {
    const value = (parseFloat(range[1]) + parseFloat(range[2])) / 2;
    return { value, rest: str.slice(range[0].length) };
  }

  const plain = str.match(/^(\d+(?:\.\d+)?)\s*/);
  if (plain) {
    return { value: parseFloat(plain[1]), rest: str.slice(plain[0].length) };
  }

  return null;
}

function consumeUnit(str) {
  const match = str.match(/^([a-zA-Z]+)\.?\s+/);
  if (!match) return null;
  const canonical = UNIT_ALIASES[match[1].toLowerCase()];
  if (!canonical) return null;
  return { unit: canonical, rest: str.slice(match[0].length) };
}

export function parseIngredientLine(rawLine) {
  const raw = rawLine.trim();
  const normalized = normalizeFractions(raw);

  const quantityResult = consumeQuantity(normalized);
  if (!quantityResult) {
    return { quantity: null, unit: null, name: raw, raw };
  }

  let { value: quantity, rest } = quantityResult;
  rest = rest.trim();

  let unit = null;
  const unitResult = consumeUnit(rest + " ");
  if (unitResult) {
    unit = unitResult.unit;
    rest = unitResult.rest.trim();
  }

  const name = rest.replace(/^of\s+/i, "").trim();

  return { quantity, unit, name: name || raw, raw };
}

export function parseIngredientsRaw(ingredientsRaw) {
  return ingredientsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseIngredientLine);
}
