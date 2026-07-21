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
      files: ['engine/src/**/*.ts', 'engine/test/**/*.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [{
            group: ['*'],
            message:
              'FR-SCH-05: engine/ may import ONLY relative paths and @capstone/shared. ' +
              'No clock, no database, no HTTP. Escalate rather than adding one.',
          }],
          paths: [],
        }],
      },
    },
  ],
};
