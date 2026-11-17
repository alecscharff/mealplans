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
