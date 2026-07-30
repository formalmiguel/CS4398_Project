/**
 * Persists which workout option a user clicked on the wellness view for a given date, so the
 * highlight survives logout/login (ad hoc frontend follow-up, ⚠️ not an SRS requirement — the
 * schedule mutation path is FR-REC-04's `POST /recommendations/apply-workout`; this is a display
 * preference only). One document per `(userId, date)`, mirroring `UserStore`/`MetricStore`.
 */
import { Collection, Db } from 'mongodb';

interface WorkoutSelectionDocument {
  readonly userId: string;
  readonly date: string;
  readonly workoutId: string;
}

export class WorkoutSelectionStore {
  private readonly selections: Collection<WorkoutSelectionDocument>;

  constructor(db: Db) {
    this.selections = db.collection<WorkoutSelectionDocument>('workoutSelections');
  }

  async ensureIndexes(): Promise<void> {
    await this.selections.createIndex({ userId: 1, date: 1 }, { unique: true });
  }

  async setSelection(userId: string, date: string, workoutId: string): Promise<void> {
    await this.selections.updateOne(
      { userId, date },
      { $set: { userId, date, workoutId } },
      { upsert: true },
    );
  }

  /** `undefined` when the user has never clicked an option for this date. */
  async getSelection(userId: string, date: string): Promise<string | undefined> {
    const doc = await this.selections.findOne({ userId, date });
    return doc?.workoutId;
  }
}
