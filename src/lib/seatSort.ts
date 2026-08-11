// Reusable natural-sort helpers for text columns that mostly contain
// numbers -- seat_number, CID, and anything similar.
//
// SQL: pure-numeric string values are cast to bigint for comparison, so
// "200" sorts after "19" and "21", not between them. Any non-numeric
// value falls through to the plain text tiebreaker at the end of the
// ordering.
//
// JS: uses Intl.Collator with numeric = true, which does the same
// natural comparison in-browser for tables driven by client-side state.

// Column-name safelist to prevent SQL injection when a caller passes
// the column name as a string.
const ALLOWED_NATURAL_COLUMNS = new Set([
  "seat_number",
  "cid",
]);

function naturalSql(column: string, direction: "ASC" | "DESC"): string {
  if (!ALLOWED_NATURAL_COLUMNS.has(column)) {
    throw new Error(`Refusing to build natural-order SQL for column "${column}"`);
  }
  const dirAll = direction === "DESC" ? "DESC" : "ASC";
  return `CASE WHEN ${column} ~ '^[0-9]+$' THEN ${column}::bigint ELSE NULL END ${dirAll} NULLS LAST, ${column} ${dirAll}`;
}

export const SEAT_ORDER_ASC = naturalSql("seat_number", "ASC");
export const SEAT_ORDER_DESC = naturalSql("seat_number", "DESC");
export const CID_ORDER_ASC = naturalSql("cid", "ASC");
export const CID_ORDER_DESC = naturalSql("cid", "DESC");

const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function compareSeatNatural(a: string, b: string): number {
  return naturalCollator.compare(a, b);
}
