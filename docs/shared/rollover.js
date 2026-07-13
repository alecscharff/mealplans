// Pure computation of what a week-rollover pass should do, given all weekState docs.
// Callers (frontend or a function) are responsible for actually writing the results.
//
// weekStates: [{ weekKey, picks, archived }]
// Returns: {
//   historyAppends: [{ weekKey, recipeUids, loggedAt }],
//   lastCookedUpdates: { [uid]: weekKey },   // apply to recipeCache
//   archivedWeekKeys: [weekKey, ...],        // weekState docs to mark archived
// }
export function computeRollover(weekStates, currentWeekKey, now = new Date()) {
  const historyAppends = [];
  const lastCookedUpdates = {};
  const archivedWeekKeys = [];

  for (const week of weekStates) {
    if (week.weekKey === currentWeekKey || week.archived) continue;

    if (week.picks && week.picks.length > 0) {
      historyAppends.push({
        weekKey: week.weekKey,
        recipeUids: week.picks.slice(),
        loggedAt: now.toISOString(),
      });
      for (const uid of week.picks) {
        lastCookedUpdates[uid] = week.weekKey;
      }
    }

    archivedWeekKeys.push(week.weekKey);
  }

  return { historyAppends, lastCookedUpdates, archivedWeekKeys };
}
