import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Runs once before the entire integration test suite.
 * Applies Prisma migrations to the test database so every test starts
 * against a schema-correct DB without needing to reset between runs.
 *
 * Prerequisite: docker-compose.test.yml must be running.
 * Run: docker compose -f docker-compose.test.yml up -d
 */
export default async function globalSetup(): Promise<void> {
  process.env['DATABASE_URL'] =
    process.env['TEST_DATABASE_URL'] ??
    'postgresql://test:test@localhost:5433/madagascar_health_test';

  process.env['REDIS_HOST'] = process.env['TEST_REDIS_HOST'] ?? 'localhost';
  process.env['REDIS_PORT'] = process.env['TEST_REDIS_PORT'] ?? '6380';

  const apiRoot = path.resolve(__dirname, '../..');

  execSync('npx prisma migrate deploy', {
    cwd: apiRoot,
    env: process.env,
    stdio: 'inherit',
  });
}
