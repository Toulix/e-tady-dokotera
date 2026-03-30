const ACTIONS = [
  {
    icon: 'block',
    label: 'Bloquer Créneau',
    iconBg: 'bg-error-container',
    iconColor: 'text-[#ba1a1a]',
  },
  {
    icon: 'edit_calendar',
    label: 'Modifier Slots',
    iconBg: 'bg-secondary-container',
    iconColor: 'text-secondary',
  },
  {
    icon: 'schedule',
    label: 'Disponibilité',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  {
    icon: 'sms',
    label: 'SMS Groupés',
    iconBg: 'bg-surface-container-highest',
    iconColor: 'text-on-surface-variant',
  },
] as const;

/**
 * Four shortcut buttons for common doctor actions.
 * Each has an icon circle that scales up on hover for a playful touch.
 */
export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {ACTIONS.map(({ icon, label, iconBg, iconColor }) => (
        <button
          key={icon}
          className="flex flex-col items-center justify-center p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10 hover:shadow-md transition-all group"
        >
          <div
            className={`w-10 h-10 rounded-full ${iconBg} ${iconColor} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}
          >
            <span className="material-symbols-outlined">{icon}</span>
          </div>
          <span className="text-xs font-bold text-on-surface text-center">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
