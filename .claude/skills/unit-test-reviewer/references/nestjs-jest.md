# NestJS + Jest Unit Testing Reference

This reference covers testing patterns, anti-patterns, and conventions specific to this
project's backend stack: **NestJS services + Repository pattern + Jest**.

---

## Project Testing Conventions

### Module Setup Pattern

Always use `Test.createTestingModule` to assemble the NestJS DI container in tests.
Never manually `new ServiceClass()` — the service may have dependencies injected by the
framework that won't be wired correctly.

```ts
// ✅ Correct
const module: TestingModule = await Test.createTestingModule({
  providers: [
    SchedulingService,
    { provide: SchedulingRepository, useValue: mockRepository },
  ],
}).compile();

service = module.get<SchedulingService>(SchedulingService);
```

### Mock Repository Convention

Define the mock as a plain object with `jest.fn()` for every method, at module scope (outside
`describe`). Reset with `jest.clearAllMocks()` in `beforeEach` — not `jest.resetAllMocks()`
(which removes implementations) and not `jest.restoreAllMocks()` (only for spies).

```ts
// ✅ Module-scope mock object
const mockRepository = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

beforeEach(async () => {
  jest.clearAllMocks(); // clears call history, keeps mock implementations
  // ... createTestingModule
});
```

### Factory Functions for Test Data

Use factory functions with `overrides` patterns instead of inline object literals.
This prevents test drift when the domain model gains new fields.

```ts
// ✅ Factory with overrides
function mockTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'template-uuid-1',
    doctorId: 'doctor-uuid-1',
    dayOfWeek: 1,
    startTime: new Date('1970-01-01T08:00:00Z'),
    // ... all fields with sensible defaults
    ...overrides,
  };
}

// Usage
mockRepository.findTemplateById.mockResolvedValue(
  mockTemplate({ doctorId: 'other-doctor' })
);
```

---

## What to Mock

In NestJS unit tests, mock **everything the service doesn't own**:

| Dependency type | How to mock |
|----------------|-------------|
| Repository (Prisma wrapper) | `jest.fn()` object injected via `useValue` |
| `EventEmitter2` (@nestjs/event-emitter) | `jest.fn()` object — assert `emit` was called with the right event |
| External adapters (SMS, email, video) | `jest.fn()` — unit tests must never send real messages |
| `ConfigService` | `jest.fn()` with `mockReturnValue` for specific keys |
| Redis/BullMQ | `jest.fn()` — never connect to real Redis in unit tests |
| `Date.now()` | `jest.spyOn(Date, 'now').mockReturnValue(...)` or `jest.useFakeTimers()` |

**Never mock the service under test itself.** If you need to mock a method on the service,
you're writing an integration test, not a unit test.

---

## Async Patterns

All NestJS service methods are async. Key Jest patterns for async:

```ts
// Testing resolved values
const result = await service.create(dto);
expect(result).toEqual(expected);

// Testing rejections — use rejects.toThrow
await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);

// Testing rejection with a specific message
await expect(service.create(dto)).rejects.toThrow('Overlapping template exists');

// Testing that a void method resolves without throwing
await expect(service.delete(id)).resolves.toBeUndefined();
```

**Do not use `done` callbacks** — they are Jest legacy. Always use `async/await` or return
a Promise from the test.

---

## Service-Layer Test Checklist

For every public service method, verify:

### ✅ Happy path
- Valid inputs → correct return value
- Default values applied correctly (e.g., `slotDurationMinutes` defaults to 30)
- Repository called with the right arguments (`toHaveBeenCalledWith`)

### ✅ Not-found path
- Repository returns `null` → service throws `NotFoundException`

### ✅ Ownership / authorization path (IDOR)
- Resource exists but belongs to a different user → service throws `ForbiddenException`
- **This is the most commonly skipped test in this codebase — always check for it**

### ✅ Validation / business rule paths
- Each validation branch that throws `BadRequestException` has its own test
- Boundary values tested: `start === end`, `start > end`, `from > to`
- Optional fields tested in both absent and present states

### ✅ Dependency interaction
- Key repository calls verified with `toHaveBeenCalledWith(...)` for correctness
- Unnecessary repository calls verified with `not.toHaveBeenCalled()` (e.g., skip overlap
  check when only non-scheduling fields change)

---

## NestJS Exception Assertions

Use the specific exception class, not a string message, unless you need to assert the message:

```ts
// ✅ Preferred — checks exception type
await expect(service.update(id, dto)).rejects.toThrow(NotFoundException);

// ✅ Also valid — checks message when the message content matters
await expect(service.update(id, dto)).rejects.toThrow('Template not found');

// ❌ Avoid — asserting generic Error loses the HTTP status information
await expect(service.update(id, dto)).rejects.toThrow(Error);
```

Common NestJS exceptions and when to use them in tests:
- `NotFoundException` — resource doesn't exist
- `ForbiddenException` — resource exists but caller doesn't own it (IDOR)
- `BadRequestException` — invalid input or business rule violation
- `ConflictException` — duplicate resource (e.g., same date exception already exists)
- `UnauthorizedException` — caller not authenticated (usually handled by guards, not services)

---

## Interaction vs. State Testing

**State test** (preferred): Assert on the *output* of the function call.

```ts
// ✅ State test — what did the service return?
const result = await service.createTemplate(doctorId, dto);
expect(result).toEqual(mockTemplate());
```

**Interaction test** (use selectively): Assert on *which collaborators were called*.

```ts
// ✅ Interaction test — valuable when you need to verify a specific repo call was made
expect(mockRepository.createTemplate).toHaveBeenCalledWith(
  expect.objectContaining({ slotDurationMinutes: 30 }),
);

// ✅ Negative interaction test — valuable to confirm an optimization
expect(mockRepository.findOverlappingTemplate).not.toHaveBeenCalled();
```

**Rule of thumb**: Default to state tests. Add interaction tests only when:
1. The side effect (repository write, event emission) is the primary point of the test, OR
2. You need to verify specific argument values passed to a collaborator

Avoid asserting on interaction details that are likely to change during refactoring
(e.g., how many times an internal private method was called).

---

## Time-Sensitive Logic

Services that call `new Date()` or `Date.now()` internally are non-deterministic by default.

```ts
// ❌ Fragile — result depends on when the test runs
it('should use default 90-day range', async () => {
  await service.getExceptions(doctorId, {});
  const [, from, to] = mockRepo.find.mock.calls[0];
  expect(to - from).toBe(90 * 24 * 60 * 60 * 1000); // may be off by 1ms
});

// ✅ Robust — capture before/after and verify range is within tolerance
it('should use default 90-day range', async () => {
  const beforeCall = Date.now();
  await service.getExceptions(doctorId, {});
  const afterCall = Date.now();

  const [, from, to] = mockRepo.find.mock.calls[0];
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  expect(from.getTime()).toBeGreaterThanOrEqual(beforeCall);
  expect(from.getTime()).toBeLessThanOrEqual(afterCall);
  expect(to.getTime() - from.getTime()).toBeCloseTo(ninetyDaysMs, -3);
});

// ✅ Alternative — use jest.useFakeTimers() for full control
beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-01-01')));
afterEach(() => jest.useRealTimers());
```

---

## EventEmitter Testing

Services that emit domain events via `EventEmitter2` should be tested for event emission:

```ts
const mockEventEmitter = { emit: jest.fn() };

// In providers:
{ provide: EventEmitter2, useValue: mockEventEmitter }

// In test:
expect(mockEventEmitter.emit).toHaveBeenCalledWith(
  'appointment.booked',
  expect.objectContaining({ appointmentId: 'uuid-1' }),
);
```

If the service *doesn't* emit an event in an error path, assert that too:

```ts
it('should not emit event when booking fails', async () => {
  mockRepo.create.mockRejectedValue(new Error('DB error'));
  await expect(service.book(dto)).rejects.toThrow();
  expect(mockEventEmitter.emit).not.toHaveBeenCalled();
});
```

---

## Common Anti-Patterns to Flag

| Anti-pattern | Severity | Why |
|-------------|----------|-----|
| `expect(result).toBeDefined()` as sole assertion | 🟠 High | The mock always resolves, so this always passes |
| Asserting `mockRepo.fn.mock.results[0].value` | 🟠 High | You're asserting the mock's own return value, not the service's output |
| `jest.resetAllMocks()` instead of `jest.clearAllMocks()` | 🟡 Medium | Removes mock implementations, causing later tests to get `undefined` |
| No `jest.clearAllMocks()` in `beforeEach` | 🟡 Medium | Call counts accumulate across tests |
| Inline object construction instead of factory | 🟢 Low | Diverges from real type over time |
| `it('should work', ...)` | 🟢 Low | Tells future readers nothing |
| Testing that `findById` returns the mock value | 🔴 Critical | Testing the mock, not the service |
