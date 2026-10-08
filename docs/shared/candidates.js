import { seededShuffle } from "./prng.js";

// Recipes never cooked (no lastCooked) sort as oldest, so they surface first.
function byLastCookedAscending(a, b) {
  const aKey = a.lastCooked || "";
  const bKey = b.lastCooked || "";
  if (aKey === bKey) return 0;
  return aKey < bKey ? -1 : 1;
}

// From the recipe cache, take the least-recently-cooked pool, deterministically
// shuffle keyed on weekKey + shuffleSeed, and take `takeCount` as this week's candidates.
export function generateCandidates(
  recipes,
  weekKey,
  shuffleSeed,
  { poolSize = 9, takeCount = 5 } = {}
) {
  const pool = recipes.slice().sort(byLastCookedAscending).slice(0, poolSize);
  const shuffled = seededShuffle(pool, `${weekKey}:${shuffleSeed}`);
  return shuffled.slice(0, takeCount).map((r) => r.uid);
}

// Keep the candidate pool unique when a user chooses a recipe already shown as
// another alternative; otherwise swap the replaced pick into its candidate slot.
export function replaceCandidate(candidates, previousUid, nextUid) {
  if (candidates.includes(nextUid)) return candidates.slice();
  if (candidates.includes(previousUid)) return candidates.map((uid) => uid === previousUid ? nextUid : uid);
  return [...candidates, nextUid];
}
