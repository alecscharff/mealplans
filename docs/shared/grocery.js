// Merge the two picked recipes' parsed ingredients, scale by family size, and group
// by a rough grocery category (produce, dairy, etc.) for easier in-store shopping.

const CATEGORY_KEYWORDS = [
  ["Produce", ["onion", "garlic", "pepper", "tomato", "lettuce", "spinach", "carrot",
    "celery", "potato", "broccoli", "cucumber", "lemon", "lime", "apple", "avocado",
    "cilantro", "parsley", "basil", "scallion", "mushroom", "zucchini", "kale", "ginger"]],
  ["Meat & Seafood", ["chicken", "beef", "pork", "turkey", "sausage", "bacon", "shrimp",
    "salmon", "fish", "steak", "ground beef", "lamb"]],
  ["Dairy & Eggs", ["milk", "cheese", "butter", "cream", "yogurt", "egg", "sour cream",
    "mozzarella", "parmesan", "cheddar"]],
  ["Bakery", ["bread", "bun", "roll", "tortilla", "bagel", "pita"]],
  ["Frozen", ["frozen"]],
  ["Spices & Seasonings", ["salt", "pepper", "cumin", "paprika", "oregano", "cinnamon",
    "chili powder", "curry", "spice", "seasoning", "bay leaf", "thyme", "rosemary"]],
  ["Pantry", ["flour", "sugar", "rice", "pasta", "oil", "vinegar", "sauce", "broth",
    "stock", "beans", "lentil", "can", "canned", "tomato paste", "honey", "syrup",
    "baking powder", "baking soda", "vanilla", "stock"]],
];

export function categorizeIngredient(name) {
  const lower = name.toLowerCase();
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return "Other";
}

function mergeKey(item) {
  return `${item.name.trim().toLowerCase()}|${item.unit || ""}`;
}

// recipes: [{ uid, name, ingredientsParsed: [{quantity, unit, name, raw}] }]
export function buildGroceryList(recipes, familySize, baseFamilySize = 4) {
  const scale = familySize / baseFamilySize;
  const merged = new Map();
  const unscalable = [];

  for (const recipe of recipes) {
    for (const item of recipe.ingredientsParsed) {
      if (item.quantity == null) {
        unscalable.push({ ...item, recipeName: recipe.name });
        continue;
      }
      const key = mergeKey(item);
      const existing = merged.get(key);
      const scaledQuantity = item.quantity * scale;
      if (existing) {
        existing.quantity += scaledQuantity;
      } else {
        merged.set(key, {
          name: item.name,
          unit: item.unit,
          quantity: scaledQuantity,
          category: categorizeIngredient(item.name),
        });
      }
    }
  }

  const groupedByCategory = {};
  for (const item of merged.values()) {
    groupedByCategory[item.category] ??= [];
    groupedByCategory[item.category].push(item);
  }

  const otherCategory = "Other (unparsed)";
  for (const item of unscalable) {
    groupedByCategory[otherCategory] ??= [];
    groupedByCategory[otherCategory].push({
      name: item.name,
      unit: null,
      quantity: null,
      raw: item.raw,
      recipeName: item.recipeName,
      category: otherCategory,
    });
  }

  for (const items of Object.values(groupedByCategory)) {
    items.sort((a, b) => a.name.localeCompare(b.name));
  }

  return groupedByCategory;
}
