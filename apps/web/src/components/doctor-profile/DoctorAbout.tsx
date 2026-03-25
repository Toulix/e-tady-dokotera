import type { DoctorProfile } from './types';
import { LANGUAGE_LABELS } from './types';

interface DoctorAboutProps {
  doctor: DoctorProfile;
}

/**
 * "À propos" section — full bio, education history, and specialization chips.
 *
 * Renders in a soft container card matching the Stitch design. Education and
 * specializations sit in a two-column grid on desktop, stacking on mobile.
 */
export default function DoctorAbout({ doctor }: DoctorAboutProps) {
  return (
    <section className="space-y-8">
      <div className="bg-surface-container-low p-8 md:p-10 rounded-xl">
        <h2 className="font-headline text-2xl font-bold mb-6">À propos</h2>

        {doctor.about && (
          <p className="text-on-surface-variant leading-relaxed mb-8">
            {doctor.about}
          </p>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Education */}
          {doctor.education.length > 0 && (
            <div>
              <h3 className="font-headline text-lg font-bold flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary">school</span>
                Éducation
              </h3>
              <ul className="space-y-3 text-on-surface-variant">
                {doctor.education.map((entry, i) => (
                  <li key={i} className="flex flex-col">
                    <span className="font-bold text-on-surface">{entry.degree}</span>
                    <span>
                      {entry.institution}
                      {entry.year ? ` (${entry.year})` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Specializations */}
          {doctor.subSpecialties.length > 0 && (
            <div>
              <h3 className="font-headline text-lg font-bold flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary">verified</span>
                Spécialisations
              </h3>
              <div className="flex flex-wrap gap-2">
                {doctor.subSpecialties.map((spec) => (
                  <span
                    key={spec}
                    className="px-3 py-1 bg-secondary-container text-on-secondary-container rounded-lg text-sm font-medium"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Languages — shown if no education or sub-specialties to fill second column */}
          {doctor.education.length === 0 && doctor.subSpecialties.length === 0 && (
            <div>
              <h3 className="font-headline text-lg font-bold flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary">translate</span>
                Langues parlées
              </h3>
              <div className="flex flex-wrap gap-2">
                {doctor.languages.map((lang) => (
                  <span
                    key={lang}
                    className="px-3 py-1 bg-secondary-container text-on-secondary-container rounded-lg text-sm font-medium"
                  >
                    {LANGUAGE_LABELS[lang] ?? lang}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Additional info badges */}
        <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-outline-variant/15">
          {doctor.videoEnabled && (
            <span className="px-3 py-1.5 bg-primary/5 text-primary rounded-lg text-sm font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">videocam</span>
              Consultation vidéo
            </span>
          )}
          {doctor.homeVisitEnabled && (
            <span className="px-3 py-1.5 bg-primary/5 text-primary rounded-lg text-sm font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">home</span>
              Visite à domicile
            </span>
          )}
          {doctor.acceptsNewPatients && (
            <span className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">person_add</span>
              Accepte de nouveaux patients
            </span>
          )}
          {doctor.durationMinutes > 0 && (
            <span className="px-3 py-1.5 bg-surface-container text-on-surface-variant rounded-lg text-sm font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">schedule</span>
              Consultation de {doctor.durationMinutes} min
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
