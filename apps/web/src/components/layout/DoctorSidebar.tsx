import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/doctor/dashboard', icon: 'dashboard', label: 'Tableau de bord' },
  { to: '/doctor/schedule', icon: 'calendar_today', label: 'Calendrier' },
  { to: '/doctor/availability', icon: 'event_available', label: 'Disponibilité hebdomadaire' },
  { to: '/doctor/appointment-settings', icon: 'settings_applications', label: 'Paramètres des rendez-vous' },
  { to: '/doctor/exceptions', icon: 'event_busy', label: 'Exceptions' },
  { to: '/doctor/patients', icon: 'groups', label: 'Patients' },
  { to: '/doctor/messages', icon: 'mail', label: 'Messages' },
  { to: '/doctor/analytics', icon: 'analytics', label: 'Analyses' },
  { to: '/doctor/settings', icon: 'settings', label: 'Paramètres' },
] as const;

/**
 * Fixed sidebar for the doctor-facing layout.
 * Uses NavLink so the active route gets highlighted automatically.
 */
export default function DoctorSidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-outline-variant/20 bg-surface-container-low z-50 flex flex-col">
      {/* Brand */}
      <div className="p-6">
        <div className="text-xl font-bold text-primary font-headline">
          e-tady dokotera
        </div>
        <div className="text-xs text-on-surface-variant font-medium tracking-wide mt-1">
          Espace Médecin
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 mt-4 space-y-1">
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/doctor/dashboard'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 mx-2 text-sm font-medium transition-colors duration-200 ${
                isActive
                  ? 'bg-primary/10 text-primary rounded-lg font-semibold'
                  : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-lg'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
            <span className="font-headline">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom section: CTA + profile */}
      <div className="p-4 mt-auto">
        <button className="w-full bg-primary text-on-primary py-3 rounded-full font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-container transition-colors">
          <span className="material-symbols-outlined text-sm">add</span>
          Nouvelle Consultation
        </button>

        <div className="mt-6 flex items-center gap-3 px-2">
          {/* Static avatar — will be replaced by real data when wired */}
          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm font-headline">
            DR
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold truncate">Dr. Rakoto</p>
            <p className="text-xs text-on-surface-variant">Cardiologue</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
