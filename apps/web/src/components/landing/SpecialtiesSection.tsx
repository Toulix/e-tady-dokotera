import { Link } from 'react-router-dom';

interface Specialty {
  label: string;
  icon: string;
  slug: string;
}

const SPECIALTIES: Specialty[] = [
  { label: 'Généraliste', icon: 'stethoscope', slug: 'generaliste' },
  { label: 'Pédiatrie', icon: 'child_care', slug: 'pediatrie' },
  { label: 'Gynécologie', icon: 'female', slug: 'gynecologie' },
  { label: 'Cardiologie', icon: 'cardiology', slug: 'cardiologie' },
  { label: 'Dentiste', icon: 'dentistry', slug: 'dentiste' },
];

/**
 * "Explore by specialty" section below the search results.
 * Each card links to /search?q=<specialty> so users can
 * quickly filter by common specialties.
 */
export default function SpecialtiesSection() {
  return (
    <section className="bg-surface-container-low py-24 px-8 mt-12 rounded-t-[5rem]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <span className="text-primary font-bold tracking-[0.2em] text-xs uppercase">
            Besoin d'un expert ?
          </span>
          <h2 className="font-headline text-4xl font-extrabold text-on-surface">
            Explorez par spécialité
          </h2>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          {SPECIALTIES.map(({ label, icon, slug }) => (
            <Link
              key={slug}
              to={`/search?q=${encodeURIComponent(slug)}`}
              className="bg-surface-container-lowest p-8 rounded-[2rem] flex flex-col items-center text-center hover:shadow-xl transition-all group"
            >
              <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-all text-primary">
                <span className="material-symbols-outlined text-3xl">{icon}</span>
              </div>
              <span className="font-headline font-bold text-on-surface">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
