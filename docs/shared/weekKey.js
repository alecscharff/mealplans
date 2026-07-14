// Monday-of-week as YYYY-MM-DD. String-sortable, no ISO week-number edge cases.

export function weekKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jsDay = d.getDay(); // Sunday=0 ... Saturday=6
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  d.setDate(d.getDate() + mondayOffset);
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

// Monday=0 ... Sunday=6, matching the spec's weekday convention (settings.deadlineDay etc.)
export function weekday(date = new Date()) {
  const jsDay = date.getDay(); // Sunday=0 ... Saturday=6
  return jsDay === 0 ? 6 : jsDay - 1;
}
