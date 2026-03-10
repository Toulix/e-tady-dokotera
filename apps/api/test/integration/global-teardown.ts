/**
 * Runs once after the entire integration test suite.
 * Individual test files are responsible for closing their own NestJS app
 * instances (call app.close() in afterAll). This hook handles any
 * process-level cleanup that cannot be done inside a test file.
 */
export default async function globalTeardown(): Promise<void> {
  // Nothing to tear down at the process level for now.
  // Each e2e spec closes its own NestJS app in afterAll(() => app.close()).
}
