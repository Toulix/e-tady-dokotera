# React Native Code Review Patterns

Applies to React Native (Expo or bare workflow) sharing a backend with NestJS.
Read alongside `nestjs-stack.md` for full-stack reviews.

---

## 🛡️ Security

- **Secure token storage**: Never store JWTs or sensitive tokens in `AsyncStorage` — it is
  unencrypted plain-text storage. Use `expo-secure-store` (Expo) or `react-native-keychain`
  (bare). Flag any `AsyncStorage.setItem('token', ...)` as 🔴 Critical.
  ```ts
  // Bad
  await AsyncStorage.setItem('access_token', token);

  // Good
  await SecureStore.setItemAsync('access_token', token);
  ```
- **Hardcoded secrets**: API keys, secrets, or internal URLs hardcoded in JS source are
  bundled into the app binary and extractable. Use `expo-constants` with env vars baked at
  build time, and never put secrets that should stay server-side in the mobile bundle.
- **Deep link validation**: If the app handles deep links (`Linking`), validate the URL
  scheme and path before acting on params — open redirect and auth code interception attacks
  are real on mobile.
- **Certificate pinning**: For high-security apps (finance, health), check whether SSL
  pinning is implemented. Its absence isn't always a bug, but flag it as 💡 for discussion.
- **Biometric auth**: `expo-local-authentication` / `react-native-biometrics` results must
  be verified server-side or used only to unlock a locally stored credential — never trust
  a client-side boolean to grant access.
- **`WebView`**: `allowsInlineMediaPlayback`, `javaScriptEnabled`, and especially
  `originWhitelist` must be tightly scoped. A `WebView` loading user-controlled URLs with
  `javaScriptEnabled` is an XSS vector. 🔴 Critical if loading untrusted content.

---

## ⚡ Performance

- **FlatList over ScrollView for lists**: `ScrollView` renders all children at once.
  Any list with potentially more than ~10 items must use `FlatList` or `SectionList`
  with `keyExtractor`. Missing this is 🟠 High — it causes severe memory and frame drops.
  ```tsx
  // Bad for long lists
  <ScrollView>{items.map(item => <Item key={item.id} {...item} />)}</ScrollView>

  // Good
  <FlatList data={items} keyExtractor={i => i.id} renderItem={({ item }) => <Item {...item} />} />
  ```
- **`getItemLayout`**: For fixed-height FlatList items, providing `getItemLayout` eliminates
  layout measurement overhead and enables `scrollToIndex` to work correctly.
- **`useCallback` on `renderItem`**: `renderItem` defined inline recreates on every parent
  render, causing all visible list items to re-render. Always `useCallback` it.
- **Image optimization**:
  - Use `expo-image` or `react-native-fast-image` instead of the built-in `<Image>` for
    caching, progressive loading, and memory management.
  - Always specify `width` and `height` — unsized images cause layout jank.
  - Avoid extremely large images scaled down in JS — resize on the server/CDN.
- **`InteractionManager.runAfterInteractions`**: Expensive operations (data parsing, heavy
  computation) triggered during navigation transitions should be deferred here to keep
  animations at 60fps.
- **Avoid anonymous functions in JSX props**: Same as React web — they recreate every render
  and prevent `React.memo` from working on child components.
- **`useMemo` / `React.memo`**: Heavy derived computations and pure presentational components
  in lists should be memoized. But flag *over-memoization* of cheap operations too — it adds
  complexity without benefit.
- **JS thread blocking**: Heavy synchronous work (large JSON parsing, complex sorting) on the
  JS thread drops frames. Offload to a web worker equivalent (`react-native-worker-threads`)
  or run on the server.
- **Hermes engine**: Ensure Hermes is enabled (default in recent RN/Expo). Some older JS
  patterns (generators without polyfill) behave differently under Hermes.

---

## 🐛 Edge Cases

- **Platform differences**: Logic that behaves differently on iOS vs Android must be gated
  with `Platform.OS` or `Platform.select`. Common traps:
  - `KeyboardAvoidingView` behavior: `'padding'` on iOS, `'height'` on Android.
  - Shadow styles: iOS uses `shadow*` props; Android uses `elevation`.
  - Status bar: height differs significantly; use `react-native-safe-area-context`.
- **Safe area**: Content must respect safe areas on notched/dynamic-island iPhones and
  gesture-nav Android. Missing `SafeAreaView` or `useSafeAreaInsets` around root screens
  is 🟡 Medium.
- **Offline / no network**: What happens when the user has no connectivity?
  - API calls should catch network errors explicitly (not just HTTP error codes).
  - Use `@react-native-community/netinfo` to detect connectivity and show appropriate UI.
  - Optimistic updates must handle rollback on failure.
- **Background / foreground transitions**: `AppState` changes can interrupt async operations.
  Auth token refresh, location tracking, and socket connections need to handle
  `background` → `active` transitions.
- **Permissions**: Location, camera, notifications — always check current permission status
  before requesting and before using the feature. Never assume a granted permission stays
  granted across app sessions.
- **Keyboard overlap**: Forms must account for the keyboard covering inputs. Test with
  `KeyboardAvoidingView` and `ScrollView` with `keyboardShouldPersistTaps='handled'`.
- **Large text / accessibility scaling**: UI must not break when the user has large font
  size enabled. Avoid fixed-height containers that clip text; test with `allowFontScaling`.

---

## 🔥 Exception Handling

- **Unhandled promise rejections**: Same as React web — all `async` functions need
  `try/catch`. In React Native, unhandled rejections show a red overlay in dev and silently
  fail in production.
- **Global error boundary**: Install `react-native-error-boundary` or a custom equivalent.
  Without it, any render error crashes the entire app with a white screen in production.
- **Network errors vs API errors**: Distinguish between `fetch` throwing (no network,
  timeout) and the server returning a non-2xx status. Both need explicit handling.
  ```ts
  try {
    const res = await fetch(url);
    if (!res.ok) throw new ApiError(res.status, await res.json());
    return await res.json();
  } catch (e) {
    if (e instanceof ApiError) { /* handle known API error */ }
    else { /* handle network failure */ }
  }
  ```
- **Crash reporting**: Ensure `Sentry` (or equivalent) is integrated with the native crash
  handler — JS errors and native crashes both. `console.error` alone is not sufficient in
  production.
- **Navigation errors**: Navigating to a screen that doesn't exist or with missing required
  params should be caught — use typed navigation params with React Navigation's TypeScript
  support to catch these at compile time.

---

## 🔧 Maintainability

- **Navigation structure**: Use typed route params with React Navigation's `RootStackParamList`.
  Untyped navigation calls (`navigation.navigate('Profile', { id })`) with no type checking
  cause runtime crashes on param mismatch.
  ```ts
  // Good — typed navigation
  type RootStackParamList = {
    Profile: { userId: string };
    Home: undefined;
  };
  ```
- **Shared code with web**: If components or hooks are shared between React web and React
  Native, ensure platform-specific code is isolated in `.native.ts` / `.web.ts` files and
  not mixed with conditionals throughout.
- **State management**: For complex app state (auth, user profile, cart), use a proper store
  (Zustand, Redux Toolkit) rather than deeply nested context or prop drilling. Check that
  persisted state (via `zustand/middleware` persist) uses `SecureStore` or encrypted storage
  for sensitive fields.
- **API layer**: API calls should be abstracted into a dedicated service/hook layer, not
  scattered raw `fetch` calls across components. Enables easy base URL swapping and
  consistent auth header injection.
- **Expo SDK upgrades**: Flag use of deprecated Expo APIs or modules with known breaking
  changes in the current SDK. Check `expo-modules-core` compatibility.
- **OTA updates**: If using Expo Updates (EAS Update), ensure that native code changes are
  NOT deployed via OTA — they require a full app store submission.

---

## 📖 Readability

- **Screen vs Component naming**: Files in `screens/` should be named `*Screen.tsx`;
  reusable UI in `components/`. Mixed naming makes navigation structure hard to follow.
- **Style organization**: Styles defined with `StyleSheet.create()` at the bottom of the
  file (or in a co-located `styles.ts`). Inline style objects in JSX recreate every render
  and bypass the native style optimization that `StyleSheet.create` provides.
  ```tsx
  // Bad
  <View style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>

  // Good
  <View style={styles.container}>
  // ...
  const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff', padding: 16 } });
  ```
- **`clsx` / `twrnc`**: If using NativeWind (Tailwind for RN), same `clsx`/`tailwind-merge`
  rules apply for conditional class composition.
- **Hook naming**: Custom hooks must start with `use`. Non-hook files with stateful logic
  that don't follow hook rules are a source of confusing bugs.

---

## 🔗 Integration with NestJS Backend

| Concern | What to check |
|---|---|
| **Auth tokens** | Stored in `SecureStore` → attached as `Authorization: Bearer` header → NestJS JwtAuthGuard validates |
| **Geolocation** | `expo-location` permission → `getCurrentPositionAsync` → lat/lng sent to NestJS → `ST_DWithin` PostGIS query |
| **Push notifications** | `expo-notifications` device token → stored in backend via API → NestJS sends via FCM/APNs |
| **Offline queue** | Failed mutations queued locally (e.g., `react-query` mutation queue) → retried on reconnect |
| **WebSocket / SSE** | Real-time updates from NestJS Gateway → `socket.io-client` in RN → handle reconnect on app foreground |
| **File upload** | `expo-image-picker` → `FormData` with `multipart/form-data` → NestJS `FileInterceptor` → validate MIME type & size server-side |
| **Error format** | NestJS `{ statusCode, message, error }` → RN API layer maps to typed error classes → UI shows appropriate message |
