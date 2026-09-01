// Sunday-of-week as YYYY-MM-DD. String-sortable, no ISO week-number edge cases.

export function weekKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jsDay = d.getDay(); // Sunday=0 ... Saturday=6
  d.setDate(d.getDate() - jsDay);
  return formatDate(d);
}

export function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Returns the weekKey `n` weeks after (or before, if negative) the given one.
export function addWeeks(weekKeyStr, n) {
  const [y, m, d] = weekKeyStr.split("-").map(Number);
  return formatDate(new Date(y, m - 1, d + 7 * n));
}

// Returns the weekKey `n` days after (or before, if negative) the given one. Used for
// the Monday->Sunday week-anchor migration (see firestore.js#migrateLegacyWeekKey) —
// a legacy Monday key is always exactly 1 day after its Sunday-anchored replacement.
export function addDays(weekKeyStr, n) {
  const [y, m, d] = weekKeyStr.split("-").map(Number);
  return formatDate(new Date(y, m - 1, d + n));
}

// Whole weeks between two weekKey strings (positive when `to` is later than `from`).
// Both are Sundays, so the day-diff is always an exact multiple of 7.
export function weeksBetween(from, to) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromDate = new Date(fy, fm - 1, fd);
  const toDate = new Date(ty, tm - 1, td);
  return Math.round((toDate - fromDate) / (7 * 24 * 60 * 60 * 1000));
}
