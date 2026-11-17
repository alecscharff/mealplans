export const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatWeekNotes(week) {
  return [
    typeof week.note === "string" ? week.note.trim() : "",
    ...WEEK_DAYS.map((day, index) => {
      const note = week.dayNotes?.[index];
      return typeof note === "string" && note.trim() ? `${day}: ${note.trim()}` : "";
    }),
  ].filter(Boolean).join("\n");
}

export function assignedDay(assignments, uid) {
  const day = assignments?.find(entry => entry.uid === uid)?.day;
  return Number.isInteger(day) && day >= 0 && day < 7 ? day : null;
}

export function dayPlan(week, recipesByUid) {
  return WEEK_DAYS.map((day, index) => ({
    day,
    meals: (week.picks || []).filter(uid => assignedDay(week.dayAssignments, uid) === index)
      .map(uid => recipesByUid[uid]?.name).filter(Boolean),
    note: typeof week.dayNotes?.[index] === "string" ? week.dayNotes[index].trim() : "",
  }));
}

export function weeklyEmailPlan(week = {}, recipesByUid = {}) {
  const confirmed = !!week.planConfirmed || week.picks?.length > 0;
  const ids = confirmed ? (week.picks || []) : (week.candidates || []).slice(0, 2);
  const names = ids.map(uid => {
    const name = recipesByUid[uid]?.name;
    const day = confirmed ? assignedDay(week.dayAssignments, uid) : null;
    return name ? `${day == null ? "" : `${WEEK_DAYS[day]}: `}${name}` : null;
  }).filter(Boolean);
  const meals = names.length ? `${confirmed ? "Planned meals" : "Suggested meals"}\n${names.map(name => `• ${name}`).join("\n")}`
    : "There are no meals on the plan yet.";
  const notes = formatWeekNotes(week);
  return `${meals}${notes ? `\n\nNotes\n${notes}` : ""}`;
}

export function replaceMealDay(assignments = [], outgoing, incoming) {
  const day = assignedDay(assignments, outgoing);
  const result = assignments.filter(entry => entry.uid !== outgoing && entry.uid !== incoming);
  if (day != null) result.push({ uid: incoming, day });
  return result;
}
