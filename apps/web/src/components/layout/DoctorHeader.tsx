/**
 * Top navigation bar for the doctor layout.
 * Sits to the right of the sidebar (ml-64) with a frosted-glass effect.
 */
export default function DoctorHeader() {
  return (
    <header className="flex items-center justify-between px-8 h-16 glass-panel sticky top-0 z-40 border-b border-outline-variant/10">
      {/* Search */}
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-96">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="Rechercher un patient, un dossier..."
            className="w-full pl-10 pr-4 py-2 bg-surface-container-highest border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-6">
        <button className="text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined">help_outline</span>
        </button>

        {/* Notification bell with unread dot */}
        <div className="relative">
          <button className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <span className="absolute top-0 right-0 w-2 h-2 bg-[#ba1a1a] rounded-full" />
        </div>

        <div className="h-8 w-px bg-outline-variant/30" />

        <button className="flex items-center gap-2 px-4 py-2 bg-secondary-container text-secondary rounded-full text-sm font-semibold hover:bg-secondary-container/80 transition-colors">
          <span className="material-symbols-outlined text-lg">event_available</span>
          Disponibilité
        </button>
      </div>
    </header>
  );
}
