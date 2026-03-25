import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import FiltersSidebar from '../components/landing/FiltersSidebar';
import DoctorCard, { type DoctorCardProps } from '../components/landing/DoctorCard';
import SpecialtyAutocomplete from '../components/landing/SpecialtyAutocomplete';
import CityAutocomplete from '../components/landing/CityAutocomplete';

/**
 * Maps a backend language enum value to a user-facing French label.
 * The API stores languages as lowercase enums (malagasy, french, english)
 * but the UI displays them in French.
 */
const LANGUAGE_LABELS: Record<string, string> = {
  malagasy: 'Malagasy',
  french: 'Français',
  english: 'Anglais',
};

/**
 * Shape of a single doctor returned by GET /doctors/search.
 * Mirrors DoctorSearchResult on the backend — snake_case because
 * the API uses raw PostgreSQL column names.
 */
interface ApiDoctorResult {
  user_id: string;
  first_name: string;
  last_name: string;
  profile_photo_url: string | null;
  specialties: string[];
  languages_spoken: string[];
  consultation_fee_mga: number;
  average_rating: number;
  total_reviews: number;
  video_consultation_enabled: boolean;
  home_visit_enabled: boolean;
  accepts_new_patients: boolean;
  about: string | null;
  distance_km?: number;
  facility_name?: string;
  facility_city?: string;
  facility_region?: string;
}

/** Converts a backend doctor object to the props shape DoctorCard expects. */
function mapApiDoctor(doc: ApiDoctorResult): DoctorCardProps {
  let location: string | undefined;
  if (doc.facility_city && doc.facility_region) {
    location = `${doc.facility_city}, ${doc.facility_region}`;
  } else if (doc.facility_city) {
    location = doc.facility_city;
  }

  return {
    id: doc.user_id,
    name: `Dr ${doc.first_name} ${doc.last_name}`,
    specialty: doc.specialties[0] ?? 'Médecin généraliste',
    fee: doc.consultation_fee_mga,
    // Backend stores rating on 0–500 scale, UI shows 0–5
    rating: doc.average_rating / 100,
    reviewCount: doc.total_reviews,
    languages: doc.languages_spoken.map((l) => LANGUAGE_LABELS[l] ?? l),
    avatarUrl: doc.profile_photo_url ?? undefined,
    location,
    distance: doc.distance_km != null ? `${doc.distance_km.toFixed(1)} km` : undefined,
    videoEnabled: doc.video_consultation_enabled,
    acceptsNewPatients: doc.accepts_new_patients,
  };
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [doctors, setDoctors] = useState<DoctorCardProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Pre-fill the compact search bar from URL params so the user sees
  // what they searched for when arriving on the results page.
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [city, setCity] = useState(searchParams.get('city') ?? 'Antananarivo');

  /**
   * Builds the API query params from the current URL search params.
   * URL params act as the single source of truth for all search state
   * (query, city, filters, sort, page) — this makes search results
   * shareable via URL and keeps filter state in sync across components.
   */
  const buildApiParams = useCallback(
    () => {
      const params = new URLSearchParams();

      const q = searchParams.get('q');
      const cityParam = searchParams.get('city');
      const specialty = searchParams.get('specialty');
      const language = searchParams.get('language');
      const sort = searchParams.get('sort');
      const limit = searchParams.get('limit') || '20';
      // Page is part of URL state — reading it here means pagination changes
      // automatically trigger the main fetch effect without duplicate logic.
      const page = searchParams.get('page') || '1';

      if (q) params.set('q', q);
      if (cityParam) params.set('city', cityParam);
      if (specialty) params.set('specialty', specialty);
      if (language) params.set('language', language);
      if (sort) params.set('sort', sort);
      params.set('page', page);
      params.set('limit', limit);

      return params;
    },
    [searchParams],
  );

  // Fetch doctors when search params change (new search / filter change)
  useEffect(() => {
    const controller = new AbortController();

    async function fetchDoctors() {
      try {
        setLoading(true);
        setError(null);

        const params = buildApiParams();
        const response = await apiClient.get('/doctors/search', {
          params,
          signal: controller.signal,
        });

        if (response.data.success && response.data.data) {
          const { doctors: raw, total, page, total_pages } = response.data.data;
          setDoctors((raw ?? []).map(mapApiDoctor));
          setTotalCount(total ?? 0);
          setCurrentPage(page ?? 1);
          setTotalPages(total_pages ?? 1);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Search failed:', err);
        setError('Impossible de charger les praticiens. Veuillez réessayer.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchDoctors();
    return () => controller.abort();
  }, [searchParams, buildApiParams]);

  /**
   * Navigates to a specific page by pushing the page number into the URL.
   * The main useEffect handles the actual fetch — no duplicate logic needed.
   */
  function handlePageChange(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) return;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(page));
      return next;
    });
    // Scroll to top so the user sees the new page from the beginning
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Updates a single URL search param while preserving the rest.
   * Resets page to 1 because changing any filter invalidates the current page.
   * useCallback gives FiltersSidebar a stable reference so its useEffect can
   * safely list this as a dependency without causing infinite re-renders.
   */
  const updateSearchParam = useCallback((key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  /**
   * Removes all sidebar filter params in a single URL update.
   * Without this, clearing N filters would trigger N separate
   * re-fetches — only the last one producing the correct result.
   */
  const clearFilters = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('language');
      next.delete('specialty');
      next.delete('availability');
      next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  /** Re-submits the search with updated query/city values. */
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (city) params.set('city', city);
    navigate(`/search?${params.toString()}`);
  }

  const cityDisplay = searchParams.get('city') || 'Antananarivo';

  /**
   * Builds the pagination range: shows pages around current page with ellipsis.
   * Example for page 5 of 10: [1, '...', 4, 5, 6, '...', 10]
   */
  function getPaginationRange(): (number | '...')[] {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | '...')[] = [1];

    if (currentPage > 3) pages.push('...');

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (currentPage < totalPages - 2) pages.push('...');

    pages.push(totalPages);
    return pages;
  }

  return (
    <div className="bg-surface min-h-screen">
      {/* Compact search header — different from the full-height HeroSearch on the
          landing page. Shows the user's current search terms and lets them refine
          without going back. Pre-filled from URL params on mount. */}
      {/* sticky: keeps the search bar visible while the user scrolls results.
          top-20 matches the fixed navbar height (h-20 = 80px) so the section
          slides directly beneath it instead of being hidden under it. */}
      <section className="sticky top-20 z-40 px-8 pt-12 pb-8 bg-surface border-b border-outline-variant/10 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-headline font-extrabold text-4xl text-primary tracking-tight mb-2">
                Trouver un professionnel
              </h1>
              <p className="text-on-surface-variant">
                Plus de 1 200 médecins disponibles pour vous soigner.
              </p>
            </div>

            {/* Search bar — pre-filled with the values from URL params */}
            <form
              onSubmit={handleSearch}
              className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl p-2 shadow-[0_20px_40px_rgba(0,83,135,0.06)] flex items-center gap-2 border border-outline-variant/20"
            >
              <div className="flex-1 min-w-0">
                <SpecialtyAutocomplete
                  value={query}
                  onChange={setQuery}
                  onSelect={setQuery}
                />
              </div>
              <div className="h-8 w-[1px] bg-outline-variant/30 hidden md:block" />
              <div className="flex-1 min-w-0">
                <CityAutocomplete
                  value={city}
                  onChange={setCity}
                  onSelect={setCity}
                />
              </div>
              <button
                type="submit"
                className="bg-primary text-on-primary px-8 py-3 rounded-xl font-bold hover:brightness-110 transition-colors shrink-0"
              >
                Rechercher
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Filters + Results — sidebar left, cards right */}
      <div className="max-w-7xl mx-auto px-8 py-10 flex gap-10">
        <FiltersSidebar
          onFilterChange={updateSearchParam}
          onClearFilters={clearFilters} />

        {/* Results section */}
        <div className="flex-1 space-y-8">
          {/* Results header with count + sort */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h3 className="font-headline font-bold text-lg text-primary">
              {loading
                ? 'Chargement...'
                : `${totalCount} praticien${totalCount !== 1 ? 's' : ''} à ${cityDisplay}`}
            </h3>
            {!loading && doctors.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-outline">
                <span>Trier par :</span>
                <select
                  value={searchParams.get('sort') || 'rating'}
                  onChange={(e) => updateSearchParam('sort', e.target.value)}
                  className="bg-transparent border-none text-primary font-bold focus:ring-0 cursor-pointer p-0 pr-6"
                >
                  <option value="rating">Pertinence</option>
                  <option value="fee_asc">Prix croissant</option>
                  <option value="fee_desc">Prix décroissant</option>
                </select>
              </div>
            )}
          </div>

          {/* Error state */}
          {error && (
            <div className="bg-error-container text-on-error-container rounded-lg p-4">
              {error}
            </div>
          )}

          {/* Loading state — only on initial load (no cards yet).
              Filter changes keep cards mounted to avoid page-height collapse. */}
          {loading && doctors.length === 0 && (
            <div className="flex justify-center py-16">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-full border-4 border-outline-variant border-t-primary animate-spin mx-auto" />
                <p className="text-outline">Recherche en cours...</p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && doctors.length === 0 && !error && (
            <div className="text-center py-16">
              <span className="material-symbols-outlined text-6xl text-outline-variant">
                search_off
              </span>
              <p className="text-outline mt-4">
                Aucun praticien ne correspond à votre recherche
                {searchParams.get('q') ? ` pour "${searchParams.get('q')}"` : ''}.
              </p>
              <p className="text-outline-variant text-sm mt-2">
                Essayez d'ajuster vos filtres ou votre localisation.
              </p>
            </div>
          )}

          {/* Doctor cards — stay mounted during re-fetches; opacity signals refresh */}
          {doctors.length > 0 && (
            <>
              <div className={`space-y-6 transition-opacity duration-150 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                {doctors.map((doctor, index) => (
                  <div key={doctor.id}>
                    <DoctorCard {...doctor} />

                    {/* Bento promo cards — inserted after the 2nd card like Stitch design.
                        Only shown on the first page so they don't repeat on every page. */}
                    {index === 1 && currentPage === 1 && doctors.length > 2 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div className="bg-gradient-to-br from-primary to-primary-container p-8 rounded-3xl text-on-primary flex flex-col justify-between min-h-[200px]">
                          <div className="space-y-2">
                            <h5 className="font-headline font-bold text-2xl">Besoin d'aide ?</h5>
                            <p className="opacity-80 text-sm max-w-xs">
                              Notre équipe est là pour vous accompagner dans votre recherche de soins.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="w-fit px-6 py-2 bg-surface-container-lowest text-primary rounded-xl font-bold text-sm mt-4"
                          >
                            Contacter le support
                          </button>
                        </div>
                        <div className="bg-secondary-container p-8 rounded-3xl text-secondary flex flex-col justify-between min-h-[200px]">
                          <div className="space-y-2">
                            <h5 className="font-headline font-bold text-2xl">Téléconsultation</h5>
                            <p className="opacity-80 text-sm max-w-xs">
                              Consultez un docteur depuis chez vous en moins de 15 minutes.
                            </p>
                          </div>
                          <button type="button" className="flex items-center gap-2 font-bold text-sm underline mt-4">
                            Voir les disponibilités
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Numbered pagination — replaces the "load more" button */}
              {totalPages > 1 && (
                <div className="flex justify-center pt-8">
                  <div className="flex gap-2">
                    {getPaginationRange().map((page, i) =>
                      page === '...' ? (
                        <span
                          key={`ellipsis-${i}`}
                          className="w-10 h-10 flex items-center justify-center text-outline"
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={page}
                          type="button"
                          onClick={() => handlePageChange(page)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-colors ${
                            currentPage === page
                              ? 'bg-primary text-on-primary'
                              : 'hover:bg-surface-container-high text-primary'
                          }`}
                        >
                          {page}
                        </button>
                      ),
                    )}

                    {/* Next page arrow */}
                    {currentPage < totalPages && (
                      <button
                        type="button"
                        onClick={() => handlePageChange(currentPage + 1)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface-container-high text-primary font-bold transition-colors"
                      >
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
