/**
 * 🔴 RED (packet 17a) — OPEN-22 and OPEN-24, the two re-attempt-provenance cases the SRS specifies
 * (FR-RSC-05, DR-06, DR-03) but no frozen test yet pins. Assigned here by team decision
 * (`docs/TEAM-MEETING.md`, OPEN-22 / OPEN-24, 24 Jul), because §4.6 bars the session that wrote the
 * reschedule module from testing it and packet 06's suite is frozen.
 *
 * ⚠️ These exercise a PLAIN FLEXIBLE TASK through the REAL `RescheduleService.sweepElapsed` — they
 * need no recommendation and do NOT call the throwing `RecommendationScheduler`. This is the exact
 * escalation the packet flags: verify whether they fail at the 17b stub or are already satisfied by
 * `sweepElapsed` as it stands. The transcript is in docs/P17A-RED-REPORT.md; read it before
 * freezing. OPEN-24's honest-reason obligation is a genuine RED — the fix is 17b's.
 *
 * ORACLE: FR-RSC-05's v2.20 note ("record a trigger only where the stored schedule holds evidence…
 * where there is no such row the placement carries no trigger at all"); DR-06 ("absent means it has
 * never been rescheduled"); and OPEN-24 / DR-03 / FR-DSH-05 (a placement's stored reason must be
 * TRUE — a first-ever placement had no failed earlier attempt to describe).
 */
import type { IsoDate, Placement, PlacementStatus, RescheduleTrigger } from '@capstone/shared';

import {
  at,
  DEMO_DATE,
  buildAcceptanceStack,
  createFlexibleTask,
  type AcceptanceStack,
} from './support/harness';

/** Persist a placement in a given historical state (a MISSED/SKIPPED row the day left behind). */
const saveWithStatus = async (
  stack: AcceptanceStack,
  taskId: string,
  window: { start: number; end: number },
  status: PlacementStatus,
  trigger?: RescheduleTrigger,
  date: IsoDate = DEMO_DATE,
): Promise<Placement> => {
  const placement: Placement = {
    id: stack.tasks.nextPlacementId(),
    taskId,
    date,
    start: window.start,
    end: window.end,
    status,
    placementReason: 'historical row',
    ...(trigger === undefined ? {} : { rescheduleTrigger: trigger }),
  };
  await stack.tasks.savePlacement(placement);
  return placement;
};

const plannedAfterSweep = async (stack: AcceptanceStack, taskId: string): Promise<Placement> => {
  const all = await stack.tasks.placementsForDate(stack.userId, DEMO_DATE);
  const planned = all.filter((p) => p.taskId === taskId && p.status === 'PLANNED');
  return planned[0] as Placement;
};

describe('OPEN-22 / OPEN-24 — re-attempt provenance (FR-RSC-05, DR-06, DR-03)', () => {
  let stack: AcceptanceStack;

  beforeEach(async () => {
    stack = await buildAcceptanceStack({ nowMinute: at(7), date: DEMO_DATE });
  });

  afterEach(async () => {
    await stack.stop();
  });

  it('OPEN-22(1)/OPEN-24: a flexible task with NO placement history, first-placed on retrieval, carries no rescheduleTrigger and no false claim of an earlier failed attempt', async () => {
    const task = await createFlexibleTask(stack, {
      title: 'Read 30 minutes',
      type: 'HABIT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: at(20), end: at(20, 30) },
    });

    await stack.reschedule.sweepElapsed(stack.userId, DEMO_DATE);

    const placed = await plannedAfterSweep(stack, task.id);

    // OPEN-22 case 1 / DR-06: absent means never rescheduled — a first placement is not a reschedule.
    expect(placed.rescheduleTrigger).toBeUndefined();

    // OPEN-24 / DR-03 / FR-DSH-05: the stored reason must be TRUE. A first-ever placement had no
    // earlier attempt that failed for want of room — so it must not CLAIM one. Property (negative),
    // not an exact replacement sentence: 17b is free to word the honest reason however it likes.
    expect(placed.placementReason).not.toMatch(/no room/i);
    expect(placed.placementReason).not.toMatch(/earlier today/i);
  });

  // ⚠️ ESCALATION — the two OPEN-22 case-2 tests below PASS against the current stack (verified:
  // `sweepElapsed`'s reattempt already reads the row's trigger — packet 07/12 behavior, FR-RSC-05
  // v2.20). They do NOT fail at the 17b stub and 17b need not touch them. They pin behavior that is
  // shipped-but-unfrozen (which is exactly what OPEN-22 asked for). The GATE must decide whether a
  // RED freeze may contain an already-green regression guard, or whether these belong against the
  // (frozen) packet-06 reschedule surface. Left here per the SRS's assignment (OPEN-22, 24 Jul);
  // flagged, not silently resolved. See docs/P17A-RED-REPORT.md.
  it('OPEN-22(2): a re-attempt that descends from a MISSED row records the MISSED trigger', async () => {
    const task = await createFlexibleTask(stack, {
      title: 'Evening run',
      type: 'WORKOUT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: at(20), end: at(20, 30) },
    });
    // The day left a MISSED row behind; there is no PLANNED placement, so the task is re-attempted.
    await saveWithStatus(stack, task.id, { start: at(20), end: at(20, 30) }, 'MISSED', 'MISSED');

    await stack.reschedule.sweepElapsed(stack.userId, DEMO_DATE);

    const placed = await plannedAfterSweep(stack, task.id);
    expect(placed.rescheduleTrigger).toBe('MISSED');
  });

  it('OPEN-22(2): a re-attempt that descends from a SKIPPED row records the SKIPPED trigger', async () => {
    const task = await createFlexibleTask(stack, {
      title: 'Evening run',
      type: 'WORKOUT',
      durationMinutes: 30,
      priority: 3,
      preferredWindow: { start: at(20), end: at(20, 30) },
    });
    await saveWithStatus(stack, task.id, { start: at(20), end: at(20, 30) }, 'SKIPPED', 'SKIPPED');

    await stack.reschedule.sweepElapsed(stack.userId, DEMO_DATE);

    const placed = await plannedAfterSweep(stack, task.id);
    expect(placed.rescheduleTrigger).toBe('SKIPPED');
  });
});
