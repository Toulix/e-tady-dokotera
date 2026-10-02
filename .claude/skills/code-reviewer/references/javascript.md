# JavaScript / TypeScript Code Review Patterns

## Security
- Never use `innerHTML` / `outerHTML` / `document.write()` with user-controlled data → XSS
- Prefer `textContent` for text, `createElement` for DOM construction
- `eval()`, `new Function()`, `setTimeout(string)` → code injection
- Validate and sanitize all user input server-side (client-side validation is UX only)
- CSRF: ensure state-changing requests require CSRF tokens or use SameSite cookies
- `JSON.parse()` on untrusted input should be wrapped in try/catch
- Prototype pollution: `Object.assign({}, userInput)` with `__proto__` key
- npm dependencies: flag use of packages with known CVEs or no maintenance

## Performance
- **Event loop blocking**: avoid synchronous crypto, `fs.readFileSync`, heavy computation in request handlers
- Memory leaks: event listeners added but never removed; `setInterval` never cleared; closures
  capturing large objects; unbounded caches (use `Map` with eviction or `WeakMap`)
- Prefer `for...of` over `forEach` for early-exit capability; avoid `for...in` on arrays
- Debounce/throttle rapid UI event handlers (scroll, resize, input)
- Lazy-load heavy modules; avoid barrel imports that pull in entire libraries
- Database: check for N+1 in ORM usage (Sequelize/Prisma `include` vs separate queries)
- Unnecessary object allocations in hot paths (e.g., creating new objects inside loops or callbacks)

## Edge Cases
- `NaN !== NaN` — use `Number.isNaN()` not `=== NaN`
- `typeof null === 'object'` — always check null explicitly
- `==` coercion surprises (`0 == ''`, `null == undefined`); default to `===`
- Array holes: `[1,,3]` behaves unexpectedly with many array methods
- `parseInt('08')` works in ES5+ but always specify radix: `parseInt(s, 10)`
- Floating point: `0.1 + 0.2 !== 0.3` — use integer math or `toFixed()` for currency
- `Date` parsing is implementation-dependent; use a library (date-fns, Temporal) for reliability
- Optional chaining `?.` and nullish coalescing `??` vs `||` (falsy vs nullish)

## Async / Exception Handling
- Unhandled promise rejections crash Node 15+ and silently fail in browsers; always `.catch()`
  or `try/catch` in `async/await`
- `async` functions inside `forEach` don't behave as expected — use `Promise.all()` with `.map()`
- Never `await` in a loop sequentially unless order matters; use `Promise.all` for parallel
- Error objects should extend `Error` class for proper stack traces
- In Express: async route handlers need `try/catch` with `next(err)` or `express-async-errors`

## TypeScript Specifics
- Avoid `any` — use `unknown` and narrow the type, or create a proper interface
- Non-null assertions `!` hide bugs; prefer optional chaining and proper null checks
- `as TypeName` casts bypass type checking — add a runtime validation instead
- Discriminated unions over boolean flags for state modeling
- `readonly` arrays and properties to prevent accidental mutation
- `strict: true` in `tsconfig.json` — if not enabled, flag it

## Maintainability
- Pure functions are easier to test; isolate side effects at the edges
- Avoid mutating function parameters; return new objects instead
- Named exports over default exports for better refactoring support
- Environment variables via `process.env` should be validated at startup and typed
- Avoid magic strings — use `const` enums or string literal unions
- Avoid deep nesting of callbacks — extract into named functions for readability
