/**
 * FR-SCH-10 — the order in which the engine is INVOKED across several flexible tasks.
 *
 * ⛔ This orders TASKS. It does not order, choose among, or produce placements: the engine is
 * still asked once per task, and it still decides where each one goes. FR-SCH-10 "governs only
 * the order in which the engine is invoked, and adds nothing to its inputs" — which is why
 * `task.priority` is read here and by nothing in `engine/src`.
 *
 * ⚠️ ONE RANKING KEY — `(has an instant, the instant, id)` — NOT a chain of pairwise special
 * cases (SRS v2.14, closing E5). The rule packet 06's first run proposed, "if either is absent,
 * compare that pair by `id`", is NOT TRANSITIVE and therefore defines no order at all:
 * A(10:00, 'a'), B(absent, 'b'), C(09:00, 'c') gives A<B, B<C and C<A, and a sort handed a cycle
 * returns whatever its pivots happen to produce — precisely the non-repeatable order FR-SCH-10
 * exists to eliminate. The key below is total by construction, and every pairwise test anyone
 * thinks to write passes under the broken comparator too, so do not "simplify" this back.
 */
import type { Task } from '@capstone/shared';

const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Ascending priority (1 first); ties break on the earlier-created task; a task with no known
 * creation instant sorts AFTER every task that has one; anything still tied breaks on `id`.
 *
 * `Task.createdAt` is an ISO 8601 UTC instant with millisecond precision, and in that format —
 * and only in that format — lexicographic order IS chronological order (contract, `IsoTimestamp`).
 */
export const byPlacementOrder = (a: Task, b: Task): number => {
  if (a.priority !== b.priority) return a.priority - b.priority;

  const aKnown = a.createdAt !== undefined;
  const bKnown = b.createdAt !== undefined;
  if (aKnown !== bKnown) return aKnown ? -1 : 1;

  if (a.createdAt !== undefined && b.createdAt !== undefined && a.createdAt !== b.createdAt) {
    return compareStrings(a.createdAt, b.createdAt);
  }

  return compareStrings(a.id, b.id);
};
