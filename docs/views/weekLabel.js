export function formatWeekLabel(weekKey) {
  const [y, m, d] = weekKey.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Week of ${label}`;
}
