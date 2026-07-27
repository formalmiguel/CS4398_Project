# Seed data attribution (FR-LIB-10)

## Workout library — `free-exercise-db.subset.json`

- **Source:** [free-exercise-db](https://github.com/yuhonas/free-exercise-db) by yuhonas.
- **Licence:** The Unlicense (public domain dedication) — https://unlicense.org.
- **Use made of it:** `free-exercise-db.subset.json` is a curated subset of the project's
  `dist/exercises.json`, restricted to the six exercise categories the intensity-tier mapping
  documents (decision B) and to the fields the seed reads (`id`, `name`, `category`, `level`,
  `equipment`, `primaryMuscles`). It is **vendored** — committed to this repository and read from
  disk at seed time (`WorkoutCatalog.seedWorkouts`). Nothing in `server/src/catalog/` fetches it at
  runtime, which keeps the recommendation path network-free (FR-LIB-02, guarded by packet 16b).

The Unlicense places the dataset in the public domain and explicitly permits copying, modification,
and redistribution — including the storage and redistribution this vendored subset relies on — for
any purpose, with no conditions.

## Meal library

The meal library is **hand-authored** (§4.2, `mealLibrary.ts`): names, calorie counts, meal types,
and dietary flags are written by the team, not sourced from any dataset. It therefore has no
external source to attribute and no licence question.
