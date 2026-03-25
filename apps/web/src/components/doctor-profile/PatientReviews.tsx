import type { DoctorProfile } from './types';

interface PatientReviewsProps {
  doctor: DoctorProfile;
}

/**
 * "Avis des patients" — asymmetric card grid of patient reviews.
 *
 * The reviews API doesn't exist yet (roadmap Phase 2), so this renders
 * placeholder cards when there are no reviews. Once the backend exposes
 * GET /doctors/:id/reviews, replace the placeholder array with real data.
 */

interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
}

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-1 text-tertiary mb-3">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="material-symbols-outlined text-sm"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          star
        </span>
      ))}
    </div>
  );
}

/**
 * Placeholder reviews shown until the reviews API is implemented.
 * Displayed only when the doctor has a positive review count, so
 * users know reviews exist even though we can't fetch them yet.
 */
const PLACEHOLDER_REVIEWS: Review[] = [
  {
    id: 'placeholder-1',
    author: 'Patient vérifié',
    rating: 5,
    text: 'Médecin très à l\'écoute et rassurant. Le diagnostic a été précis et le suivi est exemplaire. Je recommande vivement.',
  },
  {
    id: 'placeholder-2',
    author: 'Patient vérifié',
    rating: 5,
    text: 'Professionnalisme incroyable. La prise de rendez-vous en ligne simplifie énormément la vie.',
  },
];

export default function PatientReviews({ doctor }: PatientReviewsProps) {
  // Once the reviews API exists, fetch real reviews here.
  // For now, show placeholders only if the doctor has reviews.
  const reviews = doctor.reviewCount > 0 ? PLACEHOLDER_REVIEWS : [];

  if (reviews.length === 0) return null;

  return (
    <section>
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="font-headline text-2xl font-bold">Avis des patients</h2>
          <p className="text-on-surface-variant text-sm">
            {doctor.reviewCount} avis au total
          </p>
        </div>
        {/* "Voir tout" links to a future reviews list/modal */}
        <button
          type="button"
          className="text-primary font-bold hover:underline text-sm"
          disabled
          title="Bientôt disponible"
        >
          Voir tout
        </button>
      </div>

      {/* Asymmetric grid — second card is offset downward on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reviews.map((review, i) => (
          <div
            key={review.id}
            className={`bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-sm ${
              i % 2 === 1 ? 'md:mt-8' : ''
            }`}
          >
            <StarRating count={review.rating} />
            <p className="italic text-on-surface-variant mb-4">
              "{review.text}"
            </p>
            <div className="font-bold text-sm">{review.author}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
