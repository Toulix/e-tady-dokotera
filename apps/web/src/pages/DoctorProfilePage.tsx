import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { type ApiDoctorProfile, type DoctorProfile, mapApiProfile } from '../components/doctor-profile/types';
import DoctorHero from '../components/doctor-profile/DoctorHero';
import DoctorAbout from '../components/doctor-profile/DoctorAbout';
import PatientReviews from '../components/doctor-profile/PatientReviews';
import BookingCard from '../components/doctor-profile/BookingCard';
import LocationCard from '../components/doctor-profile/LocationCard';

/**
 * Doctor public profile page — accessible at /doctors/:id.
 *
 * Two-column layout on desktop (8/4 grid matching the Stitch design):
 * - Left: hero (photo + identity), about section, patient reviews
 * - Right: sticky booking card (weekly calendar + slots) and location card
 *
 * On mobile the columns stack vertically with the booking card between
 * the hero and the about section, so the CTA is visible early.
 */
export default function DoctorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    // Track whether the effect has been cleaned up so we don't call setState
    // after the component unmounts or the id changes mid-flight. The
    // AbortController cancels the HTTP request, but the `finally` block still
    // runs — without this flag, `setLoading(false)` would fire on an
    // unmounted component.
    let cancelled = false;
    const controller = new AbortController();

    async function fetchDoctor() {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<{ success: boolean; data: ApiDoctorProfile }>(
          `/doctors/${id}`,
          { signal: controller.signal },
        );
        if (!cancelled) setDoctor(mapApiProfile(response.data.data));
      } catch (err: unknown) {
        if (cancelled) return;
        // AbortController fires when the component unmounts mid-request.
        // Ignore it — there's no state to update on an unmounted component.
        if (err instanceof Error && err.name === 'CanceledError') return;

        setError('Impossible de charger le profil du médecin. Veuillez réessayer.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDoctor();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id]);

  // ── Loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="pt-12 pb-24 max-w-[1440px] mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left column skeleton */}
          <div className="lg:col-span-8 space-y-12">
            <div className="flex flex-col md:flex-row gap-10">
              <div className="w-56 h-72 md:w-72 md:h-96 rounded-xl bg-surface-container animate-pulse shrink-0" />
              <div className="flex-1 space-y-4 pt-4">
                <div className="h-6 w-48 bg-surface-container rounded animate-pulse" />
                <div className="h-12 w-80 bg-surface-container rounded animate-pulse" />
                <div className="h-20 w-full bg-surface-container rounded animate-pulse" />
                <div className="flex gap-4">
                  <div className="h-16 w-32 bg-surface-container rounded-xl animate-pulse" />
                  <div className="h-16 w-32 bg-surface-container rounded-xl animate-pulse" />
                  <div className="h-16 w-32 bg-surface-container rounded-xl animate-pulse" />
                </div>
              </div>
            </div>
            <div className="h-64 bg-surface-container rounded-xl animate-pulse" />
          </div>
          {/* Right column skeleton */}
          <div className="lg:col-span-4">
            <div className="h-[500px] bg-surface-container rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────
  if (error || !doctor) {
    return (
      <div className="pt-12 pb-24 max-w-[1440px] mx-auto px-4 md:px-8">
        <div className="max-w-lg mx-auto text-center space-y-6 py-24">
          <span className="material-symbols-outlined text-6xl text-outline">
            person_off
          </span>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            Profil introuvable
          </h1>
          <p className="text-on-surface-variant">
            {error ?? 'Ce médecin n\'existe pas ou son profil n\'est pas encore vérifié.'}
          </p>
          <Link
            to="/search"
            className="inline-block px-6 py-3 bg-primary text-on-primary rounded-full font-bold hover:shadow-lg transition-all"
          >
            Retour à la recherche
          </Link>
        </div>
      </div>
    );
  }

  // ── Main content ───────────────────────────────────────────────
  return (
    <div className="pt-8 md:pt-12 pb-24 max-w-[1440px] mx-auto px-4 md:px-8">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm text-on-surface-variant" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li>
            <Link to="/search" className="hover:text-primary transition-colors">
              Recherche
            </Link>
          </li>
          <li>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
          </li>
          <li className="text-on-surface font-medium truncate max-w-[200px]" aria-current="page">
            {doctor.fullName}
          </li>
        </ol>
      </nav>

      {/* Flat grid so each section is a direct child — this lets us use CSS
          `order` to place the booking card after the hero on mobile, while
          keeping it in the right column on desktop. A single BookingCard
          instance avoids duplicate state and future double API calls. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-8 order-1">
          <DoctorHero doctor={doctor} />
        </div>

        {/* On mobile (order-2): appears right after the hero so the CTA is
            visible early. On desktop: pinned to the right column, spanning
            all rows via row-start-1 so it stays beside the full left column. */}
        <div className="order-2 lg:order-none lg:col-span-4 lg:row-start-1 lg:row-end-4">
          <div className="sticky top-28 space-y-8">
            <BookingCard doctor={doctor} />
            <LocationCard city="Antananarivo" />
          </div>
        </div>

        <div className="lg:col-span-8 order-3">
          <DoctorAbout doctor={doctor} />
        </div>

        <div className="lg:col-span-8 order-4">
          <PatientReviews doctor={doctor} />
        </div>
      </div>
    </div>
  );
}
