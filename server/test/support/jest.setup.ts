/**
 * OPEN-25: `mongodb-memory-server` occasionally loses a race picking an ephemeral port when many
 * instances spin up at once across Jest's parallel workers (confirmed: `Port "52703" already in
 * use`, thrown by the library itself, not app code — reproduced via `npx jest --coverage` run
 * back to back). Every test in this project builds its own instance per `beforeEach`, so every
 * server test is equally exposed. A capped retry is Jest's own answer to exactly this class of
 * infrastructure flake — cheaper than serializing the whole suite (`maxWorkers: 1`), which would
 * slow every future `npm run verify` to fix something that fails on the order of 1 run in ~60.
 */
jest.retryTimes(2, { logErrorsBeforeRetry: true });
