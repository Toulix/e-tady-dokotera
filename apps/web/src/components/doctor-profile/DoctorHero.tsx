import type { DoctorProfile } from './types';

interface DoctorHeroProps {
  doctor: DoctorProfile;
}

/**
 * Hero section at the top of the doctor profile page.
 *
 * Layout: large portrait photo on the left, doctor identity and quick-glance
 * stats on the right. On mobile the photo stacks above the text.
 *
 * Matches the Stitch "Profil du Docteur" design — specialty badge, star
 * rating, short bio, and three stat cards (experience, languages, satisfaction).
 */
export default function DoctorHero({ doctor }: DoctorHeroProps) {
  const initials = `${doctor.firstName[0]}${doctor.lastName[0]}`.toUpperCase();

  // Short language codes for the stat card (e.g. "FR, MG, EN")
  const languageCodes = doctor.languages
    .map((lang) => {
      if (lang === 'french') return 'FR';
      if (lang === 'malagasy') return 'MG';
      if (lang === 'english') return 'EN';
      return lang.slice(0, 2).toUpperCase();
    })
    .join(', ');

  // Patient satisfaction as a percentage (rating out of 5 → percentage)
  const satisfaction = Math.round((doctor.rating / 5) * 100);

  return (
    <section className="flex flex-col md:flex-row gap-10 items-start">
      {/* Portrait photo with soft glow behind it */}
      <div className="relative group shrink-0">
        <div className="absolute -inset-4 bg-primary-container/20 rounded-xl blur-2xl opacity-50" />
        {doctor.avatarUrl ? (
          <img
            src={doctor.avatarUrl}
            alt={`Portrait de ${doctor.fullName}`}
            className="relative w-56 h-72 md:w-72 md:h-96 object-cover rounded-xl shadow-sm"
          />
        ) : (
          <div className="relative w-56 h-72 md:w-72 md:h-96 rounded-xl shadow-sm bg-primary-container flex items-center justify-center">
            <span className="text-on-primary-container font-headline text-6xl font-bold">
              {initials}
            </span>
          </div>
        )}
      </div>

      {/* Identity & stats */}
      <div className="flex-1 pt-2 md:pt-4">
        {/* Specialty badge + rating */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="px-4 py-1 bg-primary-container text-on-primary-container text-xs font-bold tracking-widest uppercase rounded-full">
            {doctor.specialties[0] ?? 'Médecin généraliste'}
          </span>
          <div className="flex items-center text-tertiary gap-1">
            <span
              className="material-symbols-outlined text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              star
            </span>
            <span className="text-sm font-bold">
              {doctor.rating.toFixed(1)} ({doctor.reviewCount} avis)
            </span>
          </div>
        </div>

        {/* Doctor name */}
        <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tight text-on-surface mb-6">
          {doctor.fullName}
        </h1>

        {/* Short bio */}
        {doctor.about && (
          <p className="text-lg md:text-xl text-on-surface-variant max-w-2xl leading-relaxed mb-8">
            {doctor.about}
          </p>
        )}

        {/* Quick-glance stat cards */}
        <div className="flex flex-wrap gap-4">
          <div className="px-6 py-4 bg-surface-container-low rounded-xl flex flex-col">
            <span className="text-xs font-bold text-primary tracking-widest uppercase mb-1">
              Expérience
            </span>
            <span className="font-bold text-lg">{doctor.yearsOfExperience}+ Ans</span>
          </div>
          <div className="px-6 py-4 bg-surface-container-low rounded-xl flex flex-col">
            <span className="text-xs font-bold text-primary tracking-widest uppercase mb-1">
              Langues
            </span>
            <span className="font-bold text-lg">{languageCodes}</span>
          </div>
          <div className="px-6 py-4 bg-surface-container-low rounded-xl flex flex-col">
            <span className="text-xs font-bold text-primary tracking-widest uppercase mb-1">
              Satisfaction
            </span>
            <span className="font-bold text-lg">{satisfaction}%</span>
          </div>
          <div className="px-6 py-4 bg-surface-container-low rounded-xl flex flex-col">
            <span className="text-xs font-bold text-primary tracking-widest uppercase mb-1">
              Consultation
            </span>
            <span className="font-bold text-lg">
              {doctor.fee.toLocaleString('fr-FR')} Ar
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
