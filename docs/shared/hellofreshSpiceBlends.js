// HelloFresh recipes often call for one of their own proprietary pre-mixed spice
// blends (e.g. "1 tablespoon Southwest Spice Blend") that you can't buy off a shelf —
// only ever shipped in their little labeled packets. This is a community-reverse-
// engineered reference of those blends' actual spice ratios, so a scraped recipe that
// calls for one can show what to mix yourself instead.
//
// Source: https://old.reddit.com/r/hellofresh/comments/giy5tc/hello_fresh_diy_spice_blends/
// Ratios are "parts" (relative proportions, not a fixed batch size) unless the original
// list gave absolute measurements (TBSP/tsp), which are kept as given.

export const HELLOFRESH_SPICE_BLENDS = [
  {
    name: "All American Spice Blend",
    lines: [
      "2 parts chilli powder",
      "2 parts paprika",
      "1 part ground coriander",
      "1 part garlic powder",
      "2 parts ground cumin",
      "1 part sea salt",
      "1 part cayenne pepper",
      "1 part crushed red chilli flakes",
      "1 part ground black pepper",
      "1 part dried oregano leaf (Mexican if available)",
      ".25 part cocoa powder",
      ".125 part ground cinnamon",
    ],
  },
  {
    name: "Creole Spice Blend",
    lines: [
      "1 part sweet paprika",
      "1 part onion powder",
      "1 part garlic powder",
      "1 part dried oregano",
      "1 part dried basil",
      "1/2 part dried thyme",
      "1/2 part ground black pepper",
      "1/2 part ground white pepper",
      "1 1/2 parts \"low-heat\" cayenne pepper",
    ],
  },
  {
    name: "Jerk (Jamaican) Seasoning",
    lines: [
      "12 parts garlic powder",
      "12 parts dried thyme flakes",
      "8 parts onion powder",
      "8 parts dried oregano flakes",
      "4 parts sweet paprika",
      "4 parts granulated sugar",
      "4 parts allspice",
      "2 parts ground cinnamon",
      "1 part white pepper",
      "1 part cayenne",
    ],
  },
  {
    name: "Mediterranean Spice Blend",
    lines: [
      "2 parts dried oregano",
      "1 part dried mint",
      "1 part sumac",
      "1 part ground coriander",
    ],
  },
  {
    name: "Fall Spice Blend",
    lines: ["3 parts dried thyme", "3 parts ground sage", "2 parts garlic powder", "1 part onion powder"],
  },
  {
    name: "Fall Harvest Spice Blend",
    lines: ["3 parts dried thyme", "2 parts ground sage", ".5 part garlic powder", ".5 part onion powder"],
  },
  {
    name: "Autumn (Fall) Spice Blend",
    lines: ["1 part cinnamon", "1 part ground cloves", "8 parts cumin"],
  },
  {
    name: "Southwest Spice Blend",
    lines: ["4 parts garlic powder", "2 parts cumin", "2 parts chilli powder"],
  },
  {
    name: "Smokey BBQ Seasoning",
    lines: [
      "8 parts smoked paprika",
      "6 parts granulated sugar",
      "2 parts garlic powder",
      "1 part dry mustard",
      "1 part ground cumin",
      "1 part ground ginger",
      ".5 part black pepper",
    ],
  },
  {
    name: "Shawarma Spice Blend",
    lines: [
      "2 parts turmeric",
      "2 parts cumin",
      "1 part dried coriander",
      "1 part garlic powder",
      "1 part paprika",
      ".5 part ground allspice",
      ".5 part black pepper",
    ],
  },
  {
    name: "Turkish Spice Blend",
    lines: [
      "2 parts cumin",
      "2 parts garlic powder",
      "1 part ground coriander",
      ".25 part ground allspice",
      ".25 part chilli flakes",
    ],
  },
  {
    name: "Cajun Spice Blend",
    lines: [
      "2 parts paprika",
      "2 parts onion powder",
      "1 part garlic powder",
      "1 part dried oregano",
      "1 part dried thyme",
      ".5 part dried basil",
      ".5 part cayenne",
    ],
  },
  {
    name: "Berbere Spice Blend",
    lines: [
      "3 parts paprika",
      "1 part cayenne",
      ".5 part ground coriander",
      ".25 part ground ginger",
      ".125 part ground cardamom",
      ".125 part ground fenugreek",
    ],
  },
  {
    name: "Tuscan Heat Spice Blend",
    lines: [
      "4 parts dried basil",
      "2 parts dried rosemary",
      "2 parts dried oregano",
      "2 parts garlic powder",
      "1 part cayenne pepper",
      "1 part ground fennel",
    ],
  },
  {
    name: "Fry Seasoning",
    lines: ["1 part garlic powder", "1 part onion powder", "1 part paprika"],
  },
  {
    name: "Meatloaf Seasoning",
    lines: ["2 parts garlic powder", "2 parts onion powder", "1 part dried thyme", "1 part dried basil"],
  },
  {
    name: "Tunisian Spice Blend",
    lines: [
      "4 parts ground caraway seed",
      "4 parts ground coriander",
      "4 parts smoked paprika",
      "4 parts turmeric",
      "4 parts chilli powder",
      "4 parts garlic powder",
      "1 part cayenne pepper",
      "1 part cinnamon",
      "1 part ground black pepper",
    ],
  },
  {
    name: "Mexican Spice Blend",
    lines: [
      "2 TBSP chili powder",
      "1 TBSP cumin",
      "1/2 TBSP salt",
      "1/2 TBSP ground black pepper",
      "1 tsp paprika",
      "1/2 tsp red pepper flakes",
      "1/2 tsp oregano",
      "1/2 tsp garlic powder",
      "1/2 tsp onion powder",
      "1/4 tsp ground cayenne pepper",
    ],
  },
  {
    name: "Smoky Mexican Spice Mix",
    lines: ["2 parts chilli powder", "1 part oregano", "1 part smoked paprika", "1 part cumin"],
  },
  {
    name: "Burger Spice Blend",
    lines: [
      "1 TBSP paprika",
      "1 1/4 tsp salt",
      "1 tsp ground black pepper",
      "1/2 tsp garlic powder",
      "1/2 tsp brown sugar",
      "1/2 tsp onion powder",
      "1/4 tsp ground cayenne pepper",
    ],
  },
  {
    name: "Smokey Cinnamon Paprika Spice",
    lines: [
      "1 part ground cloves",
      "8 parts onion powder",
      "8 parts ground cinnamon",
      "6 parts smoked paprika",
      "16 parts mustard powder",
      "24 parts sweet paprika",
      "24 parts white granulated sugar",
    ],
  },
  {
    name: "Swedish Spice Blend",
    lines: ["4 parts garlic powder", "2 parts allspice", "2 parts white pepper", "1 part nutmeg"],
  },
  {
    name: "Blackening Spice",
    lines: [
      "3 parts smoked paprika",
      "1.5 parts paprika",
      "1.5 parts onion powder",
      "1 part garlic powder",
      "0.5 part white pepper",
      "0.5 part black pepper",
      "0.25 part thyme",
      "0.25 part oregano",
      "0.125 part cayenne pepper",
    ],
  },
  {
    name: "Blackening (Southern Sizzle) Spice",
    lines: [
      "3 tsp smoked paprika",
      "1.5 tsp garlic powder",
      ".5 tsp white pepper",
      ".5 tsp black pepper",
      ".25 tsp thyme",
      ".25 tsp oregano",
      ".125 tsp low-heat cayenne",
    ],
  },
  {
    name: "Italian Seasoning",
    lines: [
      "1 part granulated garlic",
      "1 part oregano",
      "1 part basil",
      "1 part black pepper",
      "1 part parsley flakes",
    ],
  },
  {
    name: "Fajita Spice Blend",
    lines: [
      "4 parts paprika",
      "1 part onion powder",
      "1 part garlic powder",
      "1 part chilli powder",
      "1 part cumin",
      "1 part oregano",
    ],
  },
  {
    name: "Enchilada Spice Blend",
    lines: ["3 parts chilli powder", "1 part cumin", "1 part oregano"],
  },
  {
    name: "Moo Shu Spice Blend",
    lines: ["1 part ground ginger", "1 part garlic powder (no salt added)"],
  },
  {
    name: "Thai Seven Spice Blend",
    lines: [
      "2.5 tsp white sesame seeds",
      "1 tsp chilli flakes",
      "1 tsp ground coriander",
      "1 tsp onion powder",
      ".5 tsp garlic powder",
      ".5 tsp shrimp extract powder",
      ".25 tsp cinnamon",
      ".125 tsp low-heat cayenne",
    ],
  },
  {
    name: "Garden Ranch Spice Blend",
    lines: [
      "2 parts dried parsley",
      "1 part dried dill weed",
      "2 parts garlic powder",
      "2 parts onion powder",
      "2 parts dried onion flakes",
      "1 part ground black pepper",
      "1 part dried chives",
    ],
  },
  {
    name: "Steak Spice Blend",
    lines: [
      "1 part red chilli flakes",
      "1 part crushed coriander seed",
      "2 parts crushed dill seed",
      "3 parts crushed mustard seed",
      "4 parts dried minced garlic",
      "4 parts crushed black pepper",
      "3 parts kosher salt",
    ],
  },
  {
    name: "Bold & Savory Steak Spice Blend",
    lines: [
      "4 parts red chilli flakes",
      "1 part crushed coriander seeds",
      "2 parts crushed dill seed",
      "3 parts crushed mustard seed",
      "4 parts dried minced garlic",
      "4 parts crushed black pepper",
      "3 parts kosher salt",
    ],
  },
  {
    name: "Taco Spice Blend",
    lines: ["1 part cumin", "1 part oregano", "1 part garlic powder", "1 part chilli powder"],
  },
  {
    name: "Za'atar Blend",
    lines: [
      "1 part dried thyme flakes",
      "1 part toasted sesame seeds",
      "1 part sumac",
      ".5 part dried oregano flakes",
      ".5 part marjoram",
      ".5 part pepper",
    ],
  },
  {
    name: "Middle Eastern Spice Sachel",
    lines: [
      "5 parts paprika",
      "3 parts garlic powder",
      "2 parts turmeric",
      "2 parts coriander",
      "2 parts black pepper",
      "1 part allspice",
      "2.5 parts salt",
    ],
  },
  {
    name: "Dukkah Spice Blend",
    lines: ["4 parts almonds", "2 parts sesame seeds", "2 parts coriander seeds", "1 part cumin seeds"],
  },
  {
    name: "Chermoula Spice Blend",
    lines: [
      "24 parts cumin",
      "12 parts ground coriander",
      "6 parts sweet paprika",
      "6 parts chilli powder",
      "4 parts ground cinnamon",
      "3 parts allspice",
      "3 parts ground ginger",
      "1 part cayenne",
      "2 parts turmeric",
    ],
  },
  {
    name: "Mole Spice Blend",
    lines: ["1 part unsweetened cocoa", "1 part cumin", "1 part chilli powder", "1 part hot smoked paprika"],
  },
];

// Matches an ingredient's name/text against a known HelloFresh blend by case-insensitive
// substring — scraped ingredient lines look like "1 tablespoon Shawarma Spice Blend",
// and after quantity/unit parsing the leftover name is normally just the blend name
// itself. Longer names are checked first so e.g. "Bold & Savory Steak Spice Blend"
// doesn't get shadowed by a shorter, less specific match.
export function findSpiceBlend(ingredientText) {
  if (!ingredientText) return null;
  const lower = ingredientText.toLowerCase();
  const candidates = HELLOFRESH_SPICE_BLENDS.slice().sort((a, b) => b.name.length - a.name.length);
  return candidates.find((blend) => lower.includes(blend.name.toLowerCase())) || null;
}
