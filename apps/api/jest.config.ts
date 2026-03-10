import type { Config } from 'jest';

// Unit test configuration.
// Tests live colocated with source files as *.spec.ts.
// No database or Redis is needed — all external dependencies are mocked.
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        // Disable type-checking during test runs for speed;
        // type safety is enforced by the build step.
        diagnostics: false,
      },
    ],
  },
  // Resolve @/* path aliases defined in tsconfig.json
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coverageDirectory: '<rootDir>/coverage/unit',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
  ],
};

export default config;
