# React Patterns Reference

Deep-dive catalog of React anti-patterns, best practices, and architecture guidelines.
Load this file when reviewing any React code.

---

## Table of Contents
1. [Hook Anti-Patterns](#1-hook-anti-patterns)
2. [Component Anti-Patterns](#2-component-anti-patterns)
3. [Performance Anti-Patterns](#3-performance-anti-patterns)
4. [State Management Anti-Patterns](#4-state-management-anti-patterns)
5. [Clean Architecture Patterns](#5-clean-architecture-patterns)
6. [Custom Hook Patterns](#6-custom-hook-patterns)
7. [TypeScript React Patterns](#7-typescript-react-patterns)
8. [Testing Patterns](#8-testing-patterns)

---

## 1. Hook Anti-Patterns

### ❌ Stale Closure in useEffect

```tsx
// ❌ count is stale — captured at mount time
useEffect(() => {
  const id = setInterval(() => {
    setCount(count + 1); // always 0 + 1
  }, 1000);
  return () => clearInterval(id);
}, []); // missing count dependency

// ✅ use functional updater — no dependency needed
useEffect(() => {
  const id = setInterval(() => {
    setCount(c => c + 1);
  }, 1000);
  return () => clearInterval(id);
}, []);
```

### ❌ Object/Array in Dependency Array

```tsx
// ❌ new object reference on every render → infinite loop
useEffect(() => {
  fetchData(options);
}, [{ page: 1, limit: 10 }]); // new reference every render

// ✅ destructure primitives or memoize
const { page, limit } = options;
useEffect(() => {
  fetchData({ page, limit });
}, [page, limit]);
```

### ❌ Async Directly in useEffect

```tsx
// ❌ useEffect callback must not return a Promise
useEffect(async () => {
  const data = await fetchSomething(); // warning + no cleanup
  setData(data);
}, []);

// ✅ inner async function
useEffect(() => {
  let cancelled = false;
  async function load() {
    const data = await fetchSomething();
    if (!cancelled) setData(data);
  }
  load();
  return () => { cancelled = true; };
}, []);
```

### ❌ Deriving State in useEffect (Derived State Anti-Pattern)

```tsx
// ❌ unnecessary effect just to transform props into state
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);

// ✅ compute inline — no state, no effect
const fullName = `${firstName} ${lastName}`;
```

### ❌ Using useEffect as an Event Handler

```tsx
// ❌ this fires on every render where submitted is true, not just the event
useEffect(() => {
  if (submitted) {
    sendAnalytics('form_submitted');
  }
}, [submitted]);

// ✅ call it directly in the event handler
function handleSubmit() {
  setSubmitted(true);
  sendAnalytics('form_submitted'); // side effect belongs here
}
```

### ❌ Unnecessary useCallback / useMemo

```tsx
// ❌ memoizing a trivial primitive computation — overhead > savings
const doubled = useMemo(() => value * 2, [value]);

// ❌ memoizing a callback that isn't in any dependency array
const handleClick = useCallback(() => setOpen(true), []);

// ✅ useMemo only for expensive computations or referential stability
const sortedItems = useMemo(() => [...items].sort(compareFn), [items]);

// ✅ useCallback when the function is in a dependency array or passed to memo'd child
const onSelect = useCallback((id: string) => {
  dispatch(selectItem(id));
}, [dispatch]);
```

### ❌ useState with Previous-State Mutation

```tsx
// ❌ reading state to compute next state synchronously
setItems([...items, newItem]); // items may be stale in batched updates

// ✅ functional updater is always based on latest state
setItems(prev => [...prev, newItem]);
```

---

## 2. Component Anti-Patterns

### ❌ Component Defined Inside Component

```tsx
// ❌ MyInput is recreated every render — React sees a new type, forces full remount
function Form() {
  function MyInput({ value }: { value: string }) {
    return <input value={value} />;
  }
  return <MyInput value="hello" />;
}

// ✅ define outside the parent
function MyInput({ value }: { value: string }) {
  return <input value={value} />;
}
function Form() {
  return <MyInput value="hello" />;
}
```

### ❌ Prop Drilling 3+ Levels

```tsx
// ❌ passing user through every intermediate component
<App user={user}>
  <Layout user={user}>
    <Sidebar user={user}>
      <Avatar user={user} />

// ✅ use Context for cross-cutting concerns, or colocate state closer to use
const UserContext = createContext<User | null>(null);
function Avatar() {
  const user = useContext(UserContext); // consumed directly
}
```

### ❌ Spreading Unknown Props onto DOM Elements

```tsx
// ❌ unknown props (e.g., isLoading) forwarded to <div> → DOM warning
function Card({ isLoading, ...props }: CardProps) {
  return <div {...props} />; // isLoading reaches the DOM if not extracted
}

// ✅ destructure all non-DOM props explicitly
function Card({ isLoading, className, children, ...domProps }: CardProps) {
  return (
    <div className={cn(className, isLoading && 'opacity-50')} {...domProps}>
      {children}
    </div>
  );
}
```

### ❌ Key as Index for Dynamic Lists

```tsx
// ❌ index keys break reconciliation when items reorder, are inserted, or deleted
// React re-uses component instances by key — wrong keys cause state to "stick" to the wrong item
{items.map((item, index) => <Item key={index} {...item} />)}

// ✅ use stable, unique ids
{items.map(item => <Item key={item.id} {...item} />)}
```

> **Nuance:** Index keys are acceptable for static, never-reordered lists (e.g., a fixed
> navigation menu rendered from a constant array). The problem is specifically with dynamic
> lists where items can be added, removed, or reordered.

### ❌ Missing Error Boundaries

```tsx
// ❌ one async/lazy component crashing takes down the whole tree
<Suspense fallback={<Spinner />}>
  <LazyDashboard />
</Suspense>

// ✅ wrap with ErrorBoundary
<ErrorBoundary fallback={<ErrorMessage />}>
  <Suspense fallback={<Spinner />}>
    <LazyDashboard />
  </Suspense>
</ErrorBoundary>
```

### ❌ Boolean Trap Props

```tsx
// ❌ accumulating boolean flags is unreadable and unmaintainable
<Button isPrimary isLarge isRounded isDisabled isLoading />

// ✅ variant + size + state with union types
<Button variant="primary" size="large" shape="rounded" disabled loading />
```

---

## 3. Performance Anti-Patterns

### ❌ Unmemoized Context Value

```tsx
// ❌ new object reference every render → all consumers re-render
function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState('light');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}> {/* new obj */}
      {children}
    </ThemeContext.Provider>
  );
}

// ✅ memoize the value
function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState('light');
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
```

### ❌ Large Monolithic Context

```tsx
// ❌ any change to auth re-renders everything using AppContext
const AppContext = createContext({ user, theme, cart, notifications });

// ✅ split by update domain
const AuthContext = createContext(user);
const ThemeContext = createContext(theme);
const CartContext = createContext(cart);
```

### ❌ State Too High in the Tree

```tsx
// ❌ search input state in App re-renders entire tree on every keystroke
function App() {
  const [search, setSearch] = useState('');
  return <Layout search={search} onSearch={setSearch} />;
}

// ✅ colocate state at the lowest common ancestor
function SearchSection() {
  const [search, setSearch] = useState('');
  return <SearchBar value={search} onChange={setSearch} />;
}
```

### ❌ No Virtualization for Large Lists

```tsx
// ❌ rendering 10,000 DOM nodes
{allUsers.map(user => <UserRow key={user.id} user={user} />)}

// ✅ virtualize
import { FixedSizeList } from 'react-window';
<FixedSizeList height={600} itemCount={allUsers.length} itemSize={50}>
  {({ index, style }) => <UserRow style={style} user={allUsers[index]} />}
</FixedSizeList>
```

### ❌ Fetch in useEffect Without Abort

```tsx
// ❌ if component unmounts before fetch resolves, setState on unmounted component
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
}, []);

// ✅ use AbortController
useEffect(() => {
  const controller = new AbortController();
  fetch('/api/data', { signal: controller.signal })
    .then(r => r.json())
    .then(setData)
    .catch(err => { if (err.name !== 'AbortError') setError(err); });
  return () => controller.abort();
}, []);

// ✅✅ even better: use React Query / SWR
const { data, error, isLoading } = useQuery({ queryKey: ['data'], queryFn: fetchData });
```

---

## 4. State Management Anti-Patterns

### ❌ Redundant / Derived State

```tsx
// ❌ isFiltered is always derivable — storing it causes sync bugs
const [items, setItems] = useState([]);
const [isFiltered, setIsFiltered] = useState(false);
const [filteredItems, setFilteredItems] = useState([]);

// ✅ derive from single source of truth
const [items, setItems] = useState([]);
const [filter, setFilter] = useState('');
const filteredItems = filter
  ? items.filter(i => i.name.includes(filter))
  : items;
```

### ❌ Using useState for Server Data

```tsx
// ❌ manual loading/error/cache management
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
useEffect(() => {
  setLoading(true);
  fetch('/api/users').then(...).finally(() => setLoading(false));
}, []);

// ✅ let React Query handle server state
const { data, isLoading, error } = useQuery({
  queryKey: ['users'],
  queryFn: () => fetch('/api/users').then(r => r.json()),
});
```

### ❌ Over-Subscribing to Zustand Store

```tsx
// ❌ subscribes to entire store — re-renders on any change to any field
const state = useAuthStore();

// ✅ select only the slice you need — re-renders only when that slice changes
const userName = useAuthStore(s => s.user?.name);
const isLoggedIn = useAuthStore(s => !!s.accessToken);

// ✅ for multiple fields, use shallow equality to avoid unnecessary re-renders
import { useShallow } from 'zustand/react/shallow';
const { user, logout } = useAuthStore(useShallow(s => ({ user: s.user, logout: s.logout })));
```

---

## 5. Clean Architecture Patterns

### Custom Hooks for Logic Separation

Extract all business logic, side effects, and state out of JSX-returning components:

```tsx
// ✅ custom hook owns logic
function useProductList(categoryId: string) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['products', categoryId, page],
    queryFn: () => fetchProducts(categoryId, page),
  });
  return { products: data?.items ?? [], isLoading, page, setPage };
}

// ✅ component is pure presentation
function ProductList({ categoryId }: { categoryId: string }) {
  const { products, isLoading, page, setPage } = useProductList(categoryId);
  if (isLoading) return <Skeleton />;
  return (
    <>
      {products.map(p => <ProductCard key={p.id} product={p} />)}
      <Pagination page={page} onPageChange={setPage} />
    </>
  );
}
```

### Compound Components Pattern

For components with shared state and implicit relationships:

```tsx
// ✅ compound components via context
const TabsContext = createContext<TabsContextValue>(null!);

function Tabs({ children, defaultValue }: TabsProps) {
  const [active, setActive] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div>{children}</div>
    </TabsContext.Provider>
  );
}
Tabs.List = function TabsList({ children }: PropsWithChildren) { ... };
Tabs.Tab = function Tab({ value, children }: TabProps) {
  const { active, setActive } = useContext(TabsContext);
  return <button onClick={() => setActive(value)} aria-selected={active === value}>{children}</button>;
};
Tabs.Panel = function TabPanel({ value, children }: TabPanelProps) {
  const { active } = useContext(TabsContext);
  return active === value ? <div>{children}</div> : null;
};

// Usage: <Tabs><Tabs.List><Tabs.Tab value="a">A</Tabs.Tab></Tabs.List><Tabs.Panel value="a">...</Tabs.Panel></Tabs>
```

### Feature-Based Folder Structure

```
src/
├── features/
│   ├── auth/
│   │   ├── components/   # UI only
│   │   ├── hooks/        # useLogin, useCurrentUser
│   │   ├── api/          # fetch functions
│   │   ├── store/        # Zustand/Redux slice
│   │   └── types.ts
│   └── products/
├── shared/
│   ├── components/       # Button, Modal, Input
│   ├── hooks/            # useDebounce, useLocalStorage
│   └── utils/
└── app/                  # routing, providers, layout
```

---

## 6. Custom Hook Patterns

### ✅ useDebounce

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

### ✅ useLocalStorage

```tsx
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Use functional updater form to avoid stale closure on storedValue.
  // Without this, wrapping setValue in useCallback would either:
  //   - require storedValue as a dependency (defeating memoization), or
  //   - capture a stale storedValue (bug)
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      setStoredValue(prev => {
        const toStore = value instanceof Function ? value(prev) : value;
        window.localStorage.setItem(key, JSON.stringify(toStore));
        return toStore;
      });
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}
```

### ✅ usePrevious

```tsx
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  // No dependency array on purpose — runs after every render so ref always
  // holds the value from the previous render cycle.
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}
```

---

## 7. TypeScript React Patterns

### Strict Event Typing

```tsx
// ✅ type event handlers precisely
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};

const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
};
```

### Discriminated Union Props

```tsx
// ✅ use discriminated unions for conditional props
type ButtonProps =
  | { variant: 'link'; href: string; onClick?: never }
  | { variant: 'button'; href?: never; onClick: () => void };

function Button({ variant, ...props }: ButtonProps) {
  if (variant === 'link') return <a href={props.href}>...</a>;
  return <button onClick={props.onClick}>...</button>;
}
```

### Generic Components

```tsx
// ✅ generic components for reusable lists, selects, tables
function Select<T extends { id: string; label: string }>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <select value={value?.id ?? ''} onChange={e => onChange(options.find(o => o.id === e.target.value)!)}>
      {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}
```

### ComponentPropsWithoutRef vs HTMLAttributes

```tsx
// ✅ extend native element props cleanly
interface CardProps extends React.ComponentPropsWithoutRef<'div'> {
  variant?: 'default' | 'elevated';
}

function Card({ variant = 'default', className, ...props }: CardProps) {
  return <div className={cn('card', `card--${variant}`, className)} {...props} />;
}
```

---

## 8. Testing Patterns

### ✅ Test Behavior, Not Implementation

```tsx
// ❌ tests internal state
expect(component.state.isOpen).toBe(true);

// ✅ tests user-visible behavior
await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
expect(screen.getByRole('menu')).toBeVisible();
```

### ✅ Prefer *ByRole Queries

```tsx
// ❌ brittle — breaks on text change or classname change
screen.getByTestId('submit-btn');
screen.getByClassName('submit-button');

// ✅ accessible queries match what users actually experience
screen.getByRole('button', { name: /submit/i });
screen.getByLabelText('Email address');
screen.getByPlaceholderText('Search...');
```

### ✅ Mock at the Right Level

```tsx
// ❌ mocking internal module implementation
jest.mock('./useAuth', () => ({ useAuth: () => ({ user: mockUser }) }));

// ✅ mock the API/service boundary
jest.mock('../api/authApi');
(authApi.getUser as jest.Mock).mockResolvedValue(mockUser);
```

### ✅ Testing Async with React Query

```tsx
// wrap in QueryClientProvider with a fresh client per test
function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
```
