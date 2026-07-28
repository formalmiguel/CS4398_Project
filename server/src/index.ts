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
import type { UserRecord } from './db/UserStore';
import { TaskRepository } from './db/TaskRepository';
import { MetricStore } from './db/MetricStore';
import { RescheduleService } from './reschedule/RescheduleService';
import { WorkoutCatalog } from './catalog/WorkoutCatalog';
import { MealCatalog } from './catalog/MealCatalog';
// ⚠️ Two different interfaces are named `Catalog` (OPEN-28). This is packet 11's real library
// seam; the narrow port `RecommendationScheduler` consumes is `WorkoutSource`. Aliased on import
// so both can coexist here — ⛔ do NOT resolve the collision by deleting the alias in
// `RecommendationScheduler.ts`, which a frozen suite imports.
import type { Catalog as LibraryCatalog } from './catalog/Catalog';
import { RecommendationEngine } from './recommendation/RecommendationEngine';
import { SleepToIntensityRule } from './recommendation/SleepToIntensityRule';
import { CaloriesToTargetRule } from './recommendation/CaloriesToTargetRule';
import { RecommendationScheduler } from './recommendation/RecommendationScheduler';
import { workoutSourceFrom } from './recommendation/WorkoutSource';
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
  const catalog: LibraryCatalog = {
    findWorkouts: workouts.findWorkouts.bind(workouts),
    findMeals: meals.findMeals.bind(meals),
  };

  // ── FR-REC-04: the apply-workout path (packet 17d) ──────────────────────
  //
  // ⛔ A `RecommendationScheduler` CANNOT be a process-level singleton. Its engine must have
  // `CaloriesToTargetRule(user.baselineCalories)` registered, and that baseline is PER USER
  // (FR-REC-09; CON-05/§4.9 — the System asks for it, it never estimates one). Building this
  // once at boot would bake the first user's baseline into every other user's recommendations.
  //
  // So it is a FACTORY over the loaded user, mirroring what `GET /wellness` already does per
  // request. Everything else is the SAME instance the rest of the app uses — the same
  // `findCandidateSlots` (FR-RSC-03: one placement function), the same `RescheduleService` (so a
  // placed recommendation is defended identically to a user task), the same repository, metric
  // store and clock. The workout library reaches the scheduler through the `WorkoutSource`
  // adapter (OPEN-28).
  const workoutSource = workoutSourceFrom(catalog);
  const recommendationSchedulerFor = (user: UserRecord): RecommendationScheduler => {
    const recommendations = new RecommendationEngine();
    recommendations.register(new SleepToIntensityRule());
    recommendations.register(new CaloriesToTargetRule(user.baselineCalories));
    return new RecommendationScheduler(
      findCandidateSlots,
      reschedule,
      recommendations,
      workoutSource,
      metrics,
      tasks,
      clock,
    );
  };

  const app = buildApp({
    db,
    users,
    tasks,
    reschedule,
    clock,
    auth,
    metrics,
    catalog,
    recommendationSchedulerFor,
  });

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
