/**
 * Production entrypoint. Wires the real Mongo connection, the real engine, and the real
 * system clock into the app — the only place in this packet all three come together.
 *
 * NFR-SEC-01: this process serves plain HTTP. TLS termination is a deployment-time concern
 * (a reverse proxy in front of this process) and is out of scope for a 9-day capstone demo —
 * documented here rather than solved with a hand-rolled certificate.
 */
import 'dotenv/config';
import { findCandidateSlots } from '@capstone/engine';

import { connectMongo } from './db/mongo';
import { UserStore } from './db/UserStore';
import { TaskRepository } from './db/TaskRepository';
import { RescheduleService } from './reschedule/RescheduleService';
import { AuthService } from './api/auth';
import { SystemClock } from './api/SystemClock';
import { buildApp } from './api/app';

const PORT = Number(process.env.PORT ?? 3001);

const main = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;
  const jwtSecret = process.env.JWT_SECRET;
  if (mongoUri === undefined || jwtSecret === undefined) {
    throw new Error('MONGODB_URI and JWT_SECRET must be set (see server/.env.example)');
  }

  const db = await connectMongo(mongoUri);
  const users = new UserStore(db);
  await users.ensureIndexes();
  const tasks = new TaskRepository(db, users);
  const clock = new SystemClock();
  const reschedule = new RescheduleService(findCandidateSlots, tasks, clock);
  const auth = new AuthService(jwtSecret);

  const app = buildApp({ db, users, tasks, reschedule, clock, auth });

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`server listening on :${PORT}`);
  });
};

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
