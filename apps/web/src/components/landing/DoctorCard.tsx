import { Link } from 'react-router-dom';

export interface DoctorCardProps {
  id: string;
  name: string;
  specialty: string;
  fee: number;
  rating: number;
  reviewCount: number;
  languages: string[];
  avatarUrl?: string;
  isOnline?: boolean;
  yearsExp?: number;
  location?: string;
  distance?: string;
  availability?: string;
  availabilityUrgency?: 'soon' | 'later';
  videoEnabled?: boolean;
  acceptsNewPatients?: boolean;
}

/**
 * Doctor result card — horizontal layout adapted from the Stitch redesign.
 *
 * Structure: avatar left, info middle (name/rating, specialty chip, location,
 * availability slots, languages), fee badge top-right, CTA buttons bottom.
 *
 * Uses the existing app design tokens (primary, secondary-container, surface-*, etc.)
 * rather than the Stitch Lambda Health palette, so it stays visually consistent
 * with the rest of the app.
 */
export default function DoctorCard({
  id,
  name,
  specialty,
  fee,
  rating,
  reviewCount,
  languages,
  avatarUrl,
  location,
  distance,
  videoEnabled,
  acceptsNewPatients,
}: DoctorCardProps) {
  const formattedFee = fee.toLocaleString('fr-FR');

  /**
   * Generates initials from "Dr Firstname Lastname" for the avatar fallback.
   * Takes the first letter of first name and last name (skipping the "Dr" prefix).
   */
  const initials = name
    .replace(/^Dr\.?\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    // hover only elevates the shadow — no scale/translate so text content never shifts
    <div className="bg-surface-container-lowest rounded-2xl p-6 transition-shadow duration-300 hover:shadow-[0_24px_48px_rgba(0,83,135,0.12)] group relative border border-outline-variant/5">
      {/* Fee badge — positioned top-right like the Stitch design */}
      <div className="absolute top-6 right-6 px-3 py-1 bg-secondary-container text-secondary rounded-lg text-sm font-bold">
        {formattedFee} Ar
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Avatar — circular, with initials fallback */}
        <div className="w-24 h-24 rounded-full overflow-hidden bg-primary-container flex items-center justify-center text-on-primary text-3xl font-bold shrink-0 shadow-inner">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-on-primary-container font-headline">
              {initials}
            </span>
          )}
        </div>

        {/* Info section */}
        <div className="flex-1 space-y-4">
          {/* Name + rating */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h4 className="font-headline font-extrabold text-xl text-primary">
                {name}
              </h4>
              <span className="flex items-center gap-1 text-xs font-bold text-secondary">
                <span
                  className="material-symbols-outlined text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  star
                </span>
                {rating.toFixed(1)} ({reviewCount} avis)
              </span>
            </div>

            {/* Specialty chip + location */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="px-2.5 py-1 bg-surface-container-high rounded text-[11px] font-bold text-primary uppercase tracking-wider">
                {specialty}
              </span>

              {videoEnabled && (
                <>
                  <span className="text-outline text-xs">•</span>
                  <span className="px-2 py-0.5 bg-primary/5 text-primary rounded text-[11px] font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">videocam</span>
                    Vidéo
                  </span>
                </>
              )}

              {acceptsNewPatients && (
                <>
                  <span className="text-outline text-xs">•</span>
                  <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-[11px] font-bold">
                    Nouveaux patients
                  </span>
                </>
              )}

              {(location || distance) && (
                <>
                  <span className="text-outline text-xs">•</span>
                  <span className="text-outline text-xs flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    {location}
                    {location && distance && ' • '}
                    {distance}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Availability slots + Languages — two-column grid like Stitch */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Availability slots — placeholder until scheduling module is live */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-outline uppercase tracking-widest block">
                Prochaines dispos
              </span>
              <div className="flex gap-2">
                {/* Static placeholders — will be replaced by real slot data from scheduling API */}
                <button type="button" className="px-3 py-2 bg-surface-container-low rounded-xl text-center min-w-20 hover:bg-secondary-container transition-colors">
                  <div className="text-[10px] text-outline">Bientôt</div>
                  <div className="text-sm font-bold text-primary">—</div>
                </button>
                <button type="button" className="px-3 py-2 bg-surface-container-low rounded-xl text-center min-w-20 hover:bg-secondary-container transition-colors">
                  <div className="text-[10px] text-outline">Bientôt</div>
                  <div className="text-sm font-bold text-primary">—</div>
                </button>
              </div>
            </div>

            {/* Languages */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-outline uppercase tracking-widest block">
                Langues parlées
              </span>
              <div className="flex gap-2 flex-wrap">
                {languages.map((lang) => (
                  <span
                    key={lang}
                    className="text-xs text-on-surface-variant font-medium px-2 py-1 bg-surface-container rounded-lg"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex gap-3 pt-4 border-t border-outline-variant/10">
            <Link
              to={`/booking/${id}`}
              className="flex-1 bg-primary text-on-primary font-bold py-3 rounded-xl hover:shadow-lg hover:bg-primary-container transition-all text-center"
            >
              Réserver un rendez-vous
            </Link>
            <Link
              to={`/doctors/${id}`}
              className="px-6 py-3 border-2 border-outline-variant/20 text-primary font-bold rounded-xl hover:bg-surface-container-low transition-all text-center"
            >
              Détails
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
