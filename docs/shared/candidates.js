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

// On load, if today's weekday has reached the deadline and there aren't yet 2 picks,
// fill remaining slots from the candidates by least-recently-cooked.
export function applyDeadlineAutoPick({
  todayWeekday,
  deadlineDay,
  candidates,
  recipesByUid,
  picks,
  autoPickedIds,
  slots = 2,
}) {
  const nextPicks = picks.slice();
  const nextAutoPicked = autoPickedIds.slice();

  if (todayWeekday < deadlineDay || nextPicks.length >= slots) {
    return { picks: nextPicks, autoPickedIds: nextAutoPicked };
  }

  const remaining = candidates
    .filter((uid) => !nextPicks.includes(uid))
    .map((uid) => recipesByUid[uid])
    .filter(Boolean)
    .sort(byLastCookedAscending);

  for (const recipe of remaining) {
    if (nextPicks.length >= slots) break;
    nextPicks.push(recipe.uid);
    nextAutoPicked.push(recipe.uid);
  }

  return { picks: nextPicks, autoPickedIds: nextAutoPicked };
}
