interface Appointment {
  time: string;
  period: string;
  name: string;
  reason: string;
  status: 'confirmed' | 'pending';
}

const APPOINTMENTS: Appointment[] = [
  {
    time: '09:30',
    period: 'AM',
    name: 'Miora Andriana',
    reason: 'Checkup Général',
    status: 'confirmed',
  },
  {
    time: '10:45',
    period: 'AM',
    name: 'Fetra Rakotomalala',
    reason: 'Suivi Médical',
    status: 'pending',
  },
];

const STATUS_STYLES = {
  confirmed: {
    badge: 'bg-primary-container text-on-primary-container',
    label: 'Confirmé',
    accent: 'bg-primary',
  },
  pending: {
    badge: 'bg-secondary-container text-secondary',
    label: 'En attente',
    accent: 'bg-secondary-container',
  },
} as const;

/**
 * Today's appointment list with time, patient name, reason, and status badge.
 * The colored accent bar on the left indicates the appointment status.
 */
export default function TodaySchedule() {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
      <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between">
        <h3 className="font-bold text-lg font-headline">Programme du Jour</h3>
        <button className="text-primary text-sm font-semibold hover:underline">
          Voir tout
        </button>
      </div>

      <div className="divide-y divide-outline-variant/10">
        {APPOINTMENTS.map((appt) => {
          const style = STATUS_STYLES[appt.status];
          return (
            <div
              key={appt.time}
              className="px-6 py-5 flex items-center gap-4 hover:bg-surface-container-low transition-colors"
            >
              {/* Time block */}
              <div className="w-16 text-center">
                <p className="text-sm font-bold text-on-surface">{appt.time}</p>
                <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">
                  {appt.period}
                </p>
              </div>

              {/* Accent bar */}
              <div className={`h-10 w-[2px] ${style.accent} rounded-full`} />

              {/* Patient info */}
              <div className="flex-1">
                <h4 className="font-bold">{appt.name}</h4>
                <p className="text-sm text-on-surface-variant">{appt.reason}</p>
              </div>

              {/* Status + menu */}
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 ${style.badge} rounded-full text-xs font-semibold`}
                >
                  {style.label}
                </span>
                <button className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors">
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
