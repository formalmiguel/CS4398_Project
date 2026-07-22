import type { FindCandidateSlots } from '@capstone/shared';

/** Packet 04 (RED) writes only this stub. Packet 05 writes the engine. */
export const findCandidateSlots: FindCandidateSlots = () => {
  throw new Error('05');
};
