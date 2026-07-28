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
import { MetricStore } from './db/MetricStore';
import { RescheduleService } from './reschedule/RescheduleService';
import { WorkoutCatalog } from './catalog/WorkoutCatalog';
import { MealCatalog } from './catalog/MealCatalog';
import type { Catalog } from './catalog/Catalog';
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
  const metrics = new MetricStore(db);
  await metrics.ensureIndexes();
  const clock = new SystemClock();
  const reschedule = new RescheduleService(findCandidateSlots, tasks, clock);
  const auth = new AuthService(jwtSecret);

  // The §3.6 `Catalog` seam is one port; the two seeded libraries each implement half of it
  // (WorkoutCatalog → findWorkouts, MealCatalog → findMeals). Compose them into a single Catalog
  // so the wellness route depends on the interface, not on which class serves which method.
  const workouts = new WorkoutCatalog();
  const meals = new MealCatalog();
  const catalog: Catalog = {
    findWorkouts: workouts.findWorkouts.bind(workouts),
    findMeals: meals.findMeals.bind(meals),
  };

  const app = buildApp({ db, users, tasks, reschedule, clock, auth, metrics, catalog });

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
