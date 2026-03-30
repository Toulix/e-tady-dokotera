interface PendingRequest {
  icon: string;
  iconBg: string;
  iconColor: string;
  name: string;
  description: string;
  /** 'action' shows accept/reject buttons, 'view' shows a view button */
  type: 'action' | 'view';
}

const REQUESTS: PendingRequest[] = [
  {
    icon: 'event_repeat',
    iconBg: 'bg-[#ffdcbe]',
    iconColor: 'text-tertiary',
    name: 'Sitraka M.',
    description: 'Demande de report de RDV',
    type: 'action',
  },
  {
    icon: 'person_add',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    name: 'Lucianna R.',
    description: 'Nouveau patient - Dossier reçu',
    type: 'view',
  },
];

/**
 * List of pending patient requests requiring the doctor's attention.
 * Each request has contextual action buttons (accept/reject or view).
 */
export default function PendingRequests() {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10">
      <h3 className="font-bold text-lg mb-4 font-headline">
        Demandes en attente
      </h3>
      <div className="space-y-4">
        {REQUESTS.map((req) => (
          <div
            key={req.name}
            className="flex items-center gap-4 p-3 rounded-lg bg-surface-container-low"
          >
            <div
              className={`w-10 h-10 rounded-full ${req.iconBg} ${req.iconColor} flex items-center justify-center shrink-0`}
            >
              <span className="material-symbols-outlined">{req.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold truncate">{req.name}</h4>
              <p className="text-xs text-on-surface-variant truncate">
                {req.description}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {req.type === 'action' ? (
                <>
                  <button className="p-1 text-primary hover:bg-primary/10 rounded transition-colors">
                    <span className="material-symbols-outlined">
                      check_circle
                    </span>
                  </button>
                  <button className="p-1 text-[#ba1a1a] hover:bg-[#ba1a1a]/10 rounded transition-colors">
                    <span className="material-symbols-outlined">cancel</span>
                  </button>
                </>
              ) : (
                <button className="p-1 text-primary hover:bg-primary/10 rounded transition-colors">
                  <span className="material-symbols-outlined">visibility</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
