import { useState, useRef, useEffect, useMemo } from 'react';
import {
  techEntries,
  quickReference,
  categories,
  type TechEntry,
  type Category,
} from './techStackData';

// ──────────────────────────────────────────────
// Category badge colors
// ──────────────────────────────────────────────
const categoryColors: Record<Category, string> = {
  Backend: 'bg-purple-100 text-purple-800',
  Language: 'bg-indigo-100 text-indigo-800',
  Database: 'bg-blue-100 text-blue-800',
  'Cache & Queue': 'bg-red-100 text-red-800',
  'Real-time': 'bg-green-100 text-green-800',
  Frontend: 'bg-cyan-100 text-cyan-800',
  Mobile: 'bg-teal-100 text-teal-800',
  'Monorepo & Build': 'bg-amber-100 text-amber-800',
  Infrastructure: 'bg-orange-100 text-orange-800',
  Security: 'bg-rose-100 text-rose-800',
  Authentication: 'bg-yellow-100 text-yellow-800',
  'Events & Communication': 'bg-lime-100 text-lime-800',
  'CI/CD & Quality': 'bg-sky-100 text-sky-800',
  Monitoring: 'bg-violet-100 text-violet-800',
  Testing: 'bg-emerald-100 text-emerald-800',
  'External Services': 'bg-fuchsia-100 text-fuchsia-800',
  'API Documentation': 'bg-pink-100 text-pink-800',
  'Phase 2': 'bg-gray-100 text-gray-600',
};

// ──────────────────────────────────────────────
// Group entries by category
// ──────────────────────────────────────────────
function groupByCategory(entries: TechEntry[]) {
  const grouped: Record<string, TechEntry[]> = {};
  for (const entry of entries) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(entry);
  }
  return grouped;
}

// ──────────────────────────────────────────────
// Tech card component
// ──────────────────────────────────────────────
function TechCard({ entry }: { entry: TechEntry }) {
  return (
    <article
      id={`tech-${entry.id}`}
      className="scroll-mt-20 rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-6 py-4">
        <span className="text-sm font-medium text-gray-400">#{entry.id}</span>
        <h3 className="text-lg font-semibold text-gray-900">{entry.name}</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryColors[entry.category as Category] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {entry.category}
        </span>
      </div>

      <div className="space-y-5 px-6 py-5">
        {/* What it is */}
        <section>
          <h4 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-gray-500">
            What it is
          </h4>
          <p className="leading-relaxed text-gray-700">{entry.whatItIs}</p>
          {entry.details && (
            <p className="mt-2 leading-relaxed text-gray-600">{entry.details}</p>
          )}
        </section>

        {/* Table (optional) */}
        {entry.table && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {entry.table[0].map((header, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 text-left font-semibold text-gray-600"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entry.table.slice(1).map((row, ri) => (
                  <tr key={ri} className="border-b border-gray-50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-gray-700">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Code example (optional) */}
        {entry.codeExample && (
          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm leading-relaxed text-gray-100">
            <code>{entry.codeExample}</code>
          </pre>
        )}

        {/* Why we use it */}
        <section>
          <h4 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Why we use it
          </h4>
          <ul className="space-y-1.5">
            {entry.whyWeUseIt.map((reason, i) => (
              <li key={i} className="flex gap-2 leading-relaxed text-gray-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Without it */}
        <section>
          <h4 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Without it
          </h4>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 leading-relaxed text-amber-900">
            {entry.withoutIt}
          </p>
        </section>

        {/* Note (optional) */}
        {entry.note && (
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-800">
            {entry.note}
          </p>
        )}
      </div>
    </article>
  );
}

// ──────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────
export default function TechStackWikiPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  // Filter entries
  const filtered = useMemo(() => {
    let entries = techEntries;
    if (activeCategory) {
      entries = entries.filter((e) => e.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.whatItIs.toLowerCase().includes(q)
      );
    }
    return entries;
  }, [search, activeCategory]);

  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  // Track which card is in view for sidebar highlighting
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = Number(entry.target.id.replace('tech-', ''));
            setActiveId(id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    const cards = document.querySelectorAll('[id^="tech-"]');
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [filtered]);

  function scrollToEntry(id: number) {
    const el = document.getElementById(`tech-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setSidebarOpen(false);
    }
  }

  function scrollToQuickRef() {
    const el = document.getElementById('quick-reference');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setSidebarOpen(false);
    }
  }

  // Ordered categories for the sidebar
  const visibleCategories = categories.filter((cat) =>
    filtered.some((e) => e.category === cat)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
            aria-label="Toggle sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-gray-900">
              Tech Stack Wiki
            </h1>
            <p className="hidden text-sm text-gray-500 sm:block">
              e-tady-dokotera — {techEntries.length} technologies documented
            </p>
          </div>

          {/* Search */}
          <div className="relative w-48 sm:w-64">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search technologies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pl-10 pr-3 text-sm placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>

        {/* Category filter pills */}
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveCategory(null)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !activeCategory
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({techEntries.length})
            </button>
            {categories.map((cat) => {
              const count = techEntries.filter((e) => e.category === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() =>
                    setActiveCategory(activeCategory === cat ? null : cat)
                  }
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    activeCategory === cat
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* ── Sidebar ── */}
        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed top-0 left-0 z-40 h-full w-64 shrink-0 overflow-y-auto border-r border-gray-200 bg-white pt-4 transition-transform lg:sticky lg:top-[105px] lg:z-10 lg:h-[calc(100vh-105px)] lg:translate-x-0 lg:border-r-0 lg:bg-transparent ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <nav className="space-y-4 px-4 pb-8">
            {visibleCategories.map((cat) => (
              <div key={cat}>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-400">
                  {cat}
                </h3>
                <ul className="space-y-0.5">
                  {(grouped[cat] ?? []).map((entry) => (
                    <li key={entry.id}>
                      <button
                        onClick={() => scrollToEntry(entry.id)}
                        className={`w-full truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                          activeId === entry.id
                            ? 'bg-blue-50 font-medium text-blue-700'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <span className="mr-1.5 text-xs text-gray-400">
                          {entry.id}.
                        </span>
                        {entry.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Quick ref link */}
            <div>
              <button
                onClick={scrollToQuickRef}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              >
                Quick Reference Table
              </button>
            </div>
          </nav>
        </aside>

        {/* ── Main content ── */}
        <main ref={contentRef} className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          {/* Intro */}
          <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-sm leading-relaxed text-blue-800">
              <strong>Audience:</strong> All developers (including juniors). This
              document explains every technology we use, <strong>why</strong> we
              chose it, and <strong>what would go wrong</strong> if we didn't use
              it. If you're new to the team, read this first.
            </p>
          </div>

          {/* No results */}
          {filtered.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <p className="text-gray-500">
                No technologies match{' '}
                <span className="font-medium text-gray-700">"{search}"</span>
                {activeCategory && (
                  <>
                    {' '}in{' '}
                    <span className="font-medium text-gray-700">
                      {activeCategory}
                    </span>
                  </>
                )}
              </p>
              <button
                onClick={() => {
                  setSearch('');
                  setActiveCategory(null);
                }}
                className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Tech cards grouped by category */}
          {visibleCategories.map((cat) => (
            <section key={cat} className="mb-10">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-800">
                <span
                  className={`inline-block rounded-md px-2.5 py-1 text-xs font-semibold ${categoryColors[cat] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {cat}
                </span>
                <span className="text-sm font-normal text-gray-400">
                  ({(grouped[cat] ?? []).length})
                </span>
              </h2>
              <div className="space-y-6">
                {(grouped[cat] ?? []).map((entry) => (
                  <TechCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          ))}

          {/* ── Quick Reference ── */}
          <section
            id="quick-reference"
            className="scroll-mt-20 mt-12 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 text-xl font-bold text-gray-800">
              Quick Reference: "Which tool solves which problem?"
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">
                      Problem
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">
                      Tool
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">
                      One-line explanation
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quickReference.map((ref, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-50 hover:bg-gray-50"
                    >
                      <td className="px-3 py-2 text-gray-700">{ref.problem}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {ref.tool}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {ref.explanation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-gray-400">
            If a technology isn't listed here but shows up in the codebase, ask the
            team before removing it — it's likely there for a reason that should be
            documented.
          </p>
        </main>
      </div>
    </div>
  );
}
