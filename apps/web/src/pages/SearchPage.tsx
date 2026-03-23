import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import HeroSearch from '../components/landing/HeroSearch';
import FiltersSidebar from '../components/landing/FiltersSidebar';
import DoctorCard, { type DoctorCardProps } from '../components/landing/DoctorCard';

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
  // Build location string from facility data when available
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
    // availability + availabilityUrgency omitted — scheduling module not yet implemented
  };
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [doctors, setDoctors] = useState<DoctorCardProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  /**
   * Builds the API query params from the current URL search params.
   * URL params act as the single source of truth for all search state
   * (query, city, filters, sort, page) — this makes search results
   * shareable via URL and keeps filter state in sync across components.
   */
  const buildApiParams = useCallback(
    (page: number) => {
      const params = new URLSearchParams();

      const q = searchParams.get('q');
      const city = searchParams.get('city');
      const specialty = searchParams.get('specialty');
      const language = searchParams.get('language');
      const limit = searchParams.get('limit') || '20';

      if (q) params.set('q', q);
      if (city) params.set('city', city);
      if (specialty) params.set('specialty', specialty);
      if (language) params.set('language', language);
      params.set('page', String(page));
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

        const params = buildApiParams(1);
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

  /** Appends the next page of results to the existing list. */
  async function handleLoadMore() {
    if (loadingMore || currentPage >= totalPages) return;

    const nextPage = currentPage + 1;
    try {
      setLoadingMore(true);
      const params = buildApiParams(nextPage);
      const response = await apiClient.get('/doctors/search', { params });

      if (response.data.success && response.data.data) {
        const { doctors: raw, page } = response.data.data;
        setDoctors((prev) => [...prev, ...(raw ?? []).map(mapApiDoctor)]);
        setCurrentPage(page ?? nextPage);
      }
    } catch (err) {
      console.error('Load more failed:', err);
      setError('Erreur lors du chargement. Veuillez réessayer.');
    } finally {
      setLoadingMore(false);
    }
  }

  /**
   * Updates a single URL search param while preserving the rest.
   * Resets page to 1 because changing any filter invalidates the current page.
   */
  function updateSearchParam(key: string, value: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      // Any filter change resets pagination
      next.delete('page');
      return next;
    });
  }

  const q = searchParams.get('q');
  const city = searchParams.get('city') || 'Antananarivo';

  return (
    <div className="bg-surface min-h-screen">
      <HeroSearch />

      {/* Filters + Results grid */}
      <main className="max-w-7xl mx-auto px-8 py-12 grid grid-cols-1 lg:grid-cols-4 gap-12">
        <FiltersSidebar onFilterChange={updateSearchParam} />

        <section className="lg:col-span-3 space-y-8">
          {/* Results header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="font-headline text-2xl font-extrabold text-on-surface">
              {loading
                ? 'Chargement...'
                : `${totalCount} praticien${totalCount !== 1 ? 's' : ''} trouvé${totalCount !== 1 ? 's' : ''} à ${city}`}
            </h2>
            {!loading && doctors.length > 0 && (
              <div className="flex items-center gap-2 text-sm font-semibold text-outline">
                Trier par :
                <select
                  value={searchParams.get('sort') || 'rating'}
                  onChange={(e) => updateSearchParam('sort', e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-primary font-bold py-0 cursor-pointer"
                >
                  <option value="rating">Recommandations</option>
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

          {/* Loading state */}
          {loading && (
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
                {q ? ` pour "${q}"` : ''}.
              </p>
              <p className="text-outline-variant text-sm mt-2">
                Essayez d'ajuster vos filtres ou votre localisation.
              </p>
            </div>
          )}

          {/* Doctor cards grid */}
          {!loading && doctors.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {doctors.map((doctor) => (
                  <DoctorCard key={doctor.id} {...doctor} />
                ))}
              </div>

              {/* Load more — only shown when there are more pages */}
              {currentPage < totalPages && (
                <div className="flex justify-center pt-8">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-12 py-4 rounded-full border-2 border-primary text-primary font-bold hover:bg-primary hover:text-on-primary transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        Chargement...
                      </span>
                    ) : (
                      'Voir plus de praticiens'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
