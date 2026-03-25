/**
 * Location card with a map placeholder and facility address.
 *
 * The Stitch design shows a static grayscale map image with a pulsing pin.
 * Once react-leaflet is wired up (already in the project's tech stack), replace
 * the placeholder with a real OpenStreetMap tile centered on the facility's
 * geolocation. For now, the visual matches the design without external requests.
 */
interface LocationCardProps {
  /** Facility or clinic name. Falls back to generic label if not provided. */
  facilityName?: string;
  /** Full address string. */
  address?: string;
  /** City name — always available from the doctor profile or search context. */
  city: string;
}

export default function LocationCard({ facilityName, address, city }: LocationCardProps) {
  return (
    <div className="bg-surface-container-low p-6 rounded-xl overflow-hidden">
      {/* City header */}
      <div className="flex items-center gap-3 mb-4 px-2">
        <span className="material-symbols-outlined text-primary">location_on</span>
        <span className="font-bold">{city}, Madagascar</span>
      </div>

      {/* Map placeholder — matches the Stitch grayscale map aesthetic */}
      <div className="relative h-48 w-full rounded-lg bg-surface-variant mb-4 overflow-hidden">
        {/* Soft gradient simulating a map tile */}
        <div className="absolute inset-0 bg-gradient-to-br from-surface-container-high to-surface-variant" />
        {/* Grid lines to hint at a map */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full" style={{
            backgroundImage: 'linear-gradient(to right, var(--color-outline) 1px, transparent 1px), linear-gradient(to bottom, var(--color-outline) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
        </div>
        {/* Pulsing location pin */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 bg-primary rounded-full border-4 border-white animate-pulse shadow-lg" />
        </div>
      </div>

      {/* Facility info */}
      <div className="px-2">
        {facilityName && (
          <div className="font-bold text-sm">{facilityName}</div>
        )}
        {address && (
          <div className="text-xs text-on-surface-variant">{address}</div>
        )}
        {!facilityName && !address && (
          <div className="text-xs text-on-surface-variant">
            Adresse exacte communiquée après réservation
          </div>
        )}
      </div>
    </div>
  );
}
