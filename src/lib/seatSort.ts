// Reusable natural-sort helpers for the seat_number column.
//
// SQL: pure-numeric seat strings ('1', '19', '200') are cast to bigint for
// comparison, so "200" sorts after "19" and "21", not between them. Any
// non-numeric seat ('A01', 'B12') falls through to the plain text
// tiebreaker at the end of the ordering.
//
// JS: uses Intl.Collator with numeric = true, which does the same natural
// comparison in-browser for tables driven by client-side state.

export const SEAT_ORDER_ASC =
  "CASE WHEN seat_number ~ '^[0-9]+$' THEN seat_number::bigint ELSE NULL END NULLS LAST, seat_number";

export const SEAT_ORDER_DESC =
  "CASE WHEN seat_number ~ '^[0-9]+$' THEN seat_number::bigint ELSE NULL END DESC NULLS LAST, seat_number DESC";

const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function compareSeatNatural(a: string, b: string): number {
  return naturalCollator.compare(a, b);
}
