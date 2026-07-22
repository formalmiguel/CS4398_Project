module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2022: true },
  ignorePatterns: ['node_modules', 'dist', 'docs', 'prompts', '*.cjs'],
  overrides: [
    {
      // FR-SCH-05 purity guard, import-level. The package.json check catches
      // `npm install x -w engine`; this catches a stray import line, which is
      // the likelier mistake and the one the requirement actually cares about.
      //
      // Default-deny with explicit exemptions: `*` forbids everything, each `!`
      // re-permits one thing. Written this way so that giving the engine a new
      // import requires editing this file — which is the point of the guard.
      //
      // ⚠️ 22 Jul: this previously read `group: ['*']` with a message claiming
      // relative paths and @capstone/shared were allowed. They were not — it
      // rejected every import in engine/, including the engine's own contract
      // import. Nobody noticed because it was never exercised: engine/ was empty
      // until packet 04, so lint had nothing to check. Found by packet 04 (RED).
      files: ['engine/src/**/*.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [{
            group: [
              '*', // deny everything...
              '!@capstone', // ...but a scope dir must be re-included before anything inside it
              '@capstone/*', // ...then re-deny the sibling workspaces (server, web, engine)
              '!@capstone/shared', // ...and allow exactly one: the contract
              '!.', '!./**', '!..', '!../**', // relative paths within the engine
            ],
            message:
              'FR-SCH-05: engine/src may import ONLY relative paths and @capstone/shared. ' +
              'No clock, no database, no HTTP. Escalate rather than adding one.',
          }],
          paths: [],
        }],
      },
    },
    {
      // The same guard for the engine's tests, plus fast-check — NFR-COR-01 makes
      // the 1,000-case property test Essential, so the guard must not forbid the
      // library that requirement depends on. Test-only: nothing here is reachable
      // from engine/src, so the engine itself stays dependency-free.
      files: ['engine/test/**/*.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [{
            group: [
              '*',
              '!@capstone', // see the note in the engine/src block above — gitignore
              '@capstone/*', // semantics: a parent dir must be re-included first, so
              '!@capstone/shared', // this three-step dance is load-bearing, not redundant
              '!fast-check', // NFR-COR-01's property test. Tests only.
              '!.', '!./**', '!..', '!../**',
            ],
            message:
              'FR-SCH-05: engine/test may import ONLY relative paths, @capstone/shared, ' +
              'and fast-check (NFR-COR-01). No clock, no database, no HTTP.',
          }],
          paths: [],
        }],
      },
    },
  ],
};
