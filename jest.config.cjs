/** Root Jest config. One project per workspace. */
module.exports = {
  projects: ['<rootDir>/shared', '<rootDir>/engine', '<rootDir>/server'],
  // NFR-MNT-01 (Essential): the engine is held to 90% lines. This is a FAILING
  // BUILD, not a number someone is supposed to look at.
  coverageThreshold: {
    './engine/src/': { lines: 90, statements: 90, branches: 80, functions: 90 },
  },
  collectCoverageFrom: ['engine/src/**/*.ts', 'shared/src/**/*.ts'],
};
