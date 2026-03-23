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
  /** Years of experience — not yet returned by search API, shown only when available */
  yearsExp?: number;
  /** Facility city/region — only present when the doctor has a registered facility */
  location?: string;
  /** Distance from user — only present when geo filter (lat/lng/radius_km) is active */
  distance?: string;
  /** Next available slot — requires scheduling module (Phase 3) */
  availability?: string;
  /** "soon" renders green, "later" renders blue-ish */
  availabilityUrgency?: 'soon' | 'later';
  /** Whether the doctor accepts video consultations */
  videoEnabled?: boolean;
  /** Whether the doctor accepts new patients */
  acceptsNewPatients?: boolean;
}

/**
 * Single doctor result card used in the search results grid.
 * Shows avatar, credentials, price, rating, location, availability,
 * and two CTAs: "Détails" → doctor profile, "Réserver" → booking flow.
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
  isOnline = false,
  yearsExp,
  location,
  distance,
  availability,
  availabilityUrgency,
  videoEnabled,
  acceptsNewPatients,
}: DoctorCardProps) {
  const formattedFee = fee.toLocaleString('fr-FR');

  return (
    <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all border border-transparent hover:border-primary-container/40 group">
      {/* Top row: avatar + info + price */}
      <div className="flex gap-6 mb-6">
        {/* Avatar with online indicator */}
        <div className="relative shrink-0">
          <div className="w-24 h-24 rounded-full bg-surface-container-high ring-4 ring-surface-container shadow-inner overflow-hidden">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-outline">
                <span className="material-symbols-outlined text-4xl">person</span>
              </div>
            )}
          </div>
          {isOnline && (
            <div className="absolute -bottom-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-4 border-white" />
          )}
        </div>

        {/* Name, specialty, rating */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <h3 className="font-headline text-xl font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                {name}
              </h3>
              <p className="text-primary font-semibold text-sm">
                {specialty}
                {yearsExp != null && <> &bull; {yearsExp} ans d'exp.</>}
              </p>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className="font-extrabold text-on-surface">{formattedFee} Ar</span>
              <span className="text-[10px] text-outline uppercase font-bold">
                Consultation
              </span>
            </div>
          </div>

          {/* Rating + badges */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-1 text-tertiary">
              <span
                className="material-symbols-outlined text-lg"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                star
              </span>
              <span className="font-bold text-sm">{rating.toFixed(1)}</span>
            </div>
            <span className="text-xs text-outline font-medium">({reviewCount} avis)</span>

            {/* Capability badges — video, new patients */}
            {videoEnabled && (
              <span className="px-2 py-0.5 bg-tertiary/10 text-tertiary rounded-full text-[10px] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">videocam</span>
                Vidéo
              </span>
            )}
            {acceptsNewPatients && (
              <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[10px] font-bold">
                Nouveaux patients
              </span>
            )}

            <div className="flex gap-1 ml-auto">
              {languages.map((lang) => (
                <span
                  key={lang}
                  className="px-1.5 py-0.5 bg-surface-container rounded text-[10px] font-bold"
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: location, availability, CTAs */}
      <div className="space-y-4 border-t border-outline-variant/10 pt-4">
        <div className="flex items-center justify-between text-sm">
          {/* Location — only shown when facility data is available */}
          {(location || distance) && (
            <div className="flex items-center gap-2 text-outline">
              <span className="material-symbols-outlined text-base">location_on</span>
              <span>
                {location}
                {location && distance && ' \u2022 '}
                {distance}
              </span>
            </div>
          )}
          {/* Availability — shown when scheduling data exists, placeholder otherwise */}
          {availability ? (
            <span
              className={`font-bold px-3 py-1 rounded-full text-xs ${
                availabilityUrgency === 'soon'
                  ? 'text-green-600 bg-green-50'
                  : 'text-primary bg-primary/5'
              }`}
            >
              {availability}
            </span>
          ) : (
            <span className="font-bold px-3 py-1 rounded-full text-xs text-outline bg-surface-container">
              Voir disponibilités
            </span>
          )}
        </div>

        <div className="flex gap-3">
          <Link
            to={`/doctors/${id}`}
            className="flex-1 py-3 rounded-full bg-primary-container/20 text-primary font-bold text-sm hover:brightness-105 transition-all text-center"
          >
            Détails
          </Link>
          <Link
            to={`/booking/${id}`}
            className="flex-[2] py-3 rounded-full bg-primary text-on-primary font-bold text-sm hover:shadow-lg transition-all shadow-primary/10 text-center"
          >
            Réserver
          </Link>
        </div>
      </div>
    </div>
  );
}
