import type { Config } from 'jest';

// Integration test configuration.
// Tests live in test/integration/ as *.e2e-spec.ts.
// Requires a real PostgreSQL + Redis instance — use docker-compose.test.yml.
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/test/integration/**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Runs once before all test suites: applies DB migrations
  globalSetup: '<rootDir>/test/integration/global-setup.ts',
  // Runs once after all test suites: closes DB/Redis connections
  globalTeardown: '<rootDir>/test/integration/global-teardown.ts',
  // Give each test more time — network + DB I/O is slow
  testTimeout: 30_000,
  coverageDirectory: '<rootDir>/coverage/integration',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
  ],
};

export default config;
