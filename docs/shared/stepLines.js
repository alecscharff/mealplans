// Splits a single instruction step into its component sentences so each can be
// checked off individually on the cooking page. A step often bundles 2-3 discrete
// actions into one run-on paragraph (e.g. "Preheat the oven to 425°F. Dice the onion
// and mince the garlic.") — this breaks it back into individually-crossable lines.
//
// Only splits at a sentence-ending punctuation mark followed by whitespace and then
// an uppercase letter, digit, quote, or bold marker — this avoids false splits on
// abbreviations ("1 tbsp. flour", lowercase follows) and decimals ("1.5 cups", no
// whitespace follows the period at all).
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-Z0-9*"'])/;

export function splitStepIntoLines(step) {
  return String(step)
    .trim()
    .split(SENTENCE_BOUNDARY)
    .map((line) => line.trim())
    .filter(Boolean);
}
