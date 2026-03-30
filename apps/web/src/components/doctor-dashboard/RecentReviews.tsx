interface Review {
  name: string;
  rating: number;
  text: string;
}

const REVIEWS: Review[] = [
  {
    name: 'Tahina H.',
    rating: 5,
    text: "Excellent médecin, très à l'écoute. La clinique est moderne et accueillante.",
  },
  {
    name: 'Sanda R.',
    rating: 4,
    text: 'Ponctuel et professionnel. Je recommande vivement le Dr. Rakoto.',
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex text-tertiary">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="material-symbols-outlined text-xs"
          style={{
            fontVariationSettings: `'FILL' ${i <= rating ? 1 : 0}`,
          }}
        >
          star
        </span>
      ))}
    </div>
  );
}

/**
 * Recent patient reviews with star ratings and quotes.
 * Renders the last two reviews — will be paginated once wired to the API.
 */
export default function RecentReviews() {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10">
      <h3 className="font-bold text-lg mb-4 font-headline">Avis Récents</h3>
      <div className="space-y-4">
        {REVIEWS.map((review, idx) => (
          <div key={review.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold">{review.name}</h4>
              <StarRating rating={review.rating} />
            </div>
            <p className="text-xs text-on-surface-variant italic leading-relaxed">
              "{review.text}"
            </p>
            {/* Separator between reviews, but not after the last one */}
            {idx < REVIEWS.length - 1 && (
              <div className="h-px bg-outline-variant/10 w-full" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
