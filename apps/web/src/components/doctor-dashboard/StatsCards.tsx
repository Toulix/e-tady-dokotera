/**
 * Three stacked stat cards: patients count, average rating, and revenue.
 * The revenue card uses a primary-colored background with a mini bar sparkline.
 */
export default function StatsCards() {
  return (
    <div className="space-y-6">
      {/* Patients du jour */}
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-on-surface-variant">
              Patients du jour
            </p>
            <h3 className="text-4xl font-extrabold mt-2 font-headline">12</h3>
          </div>
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              person
            </span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-primary">
          <span className="material-symbols-outlined text-sm">trending_up</span>
          <span>+15 Nouveaux cette semaine</span>
        </div>
      </div>

      {/* Note moyenne */}
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-on-surface-variant">
              Note moyenne
            </p>
            <h3 className="text-4xl font-extrabold mt-2 font-headline">4.9</h3>
          </div>
          <div className="p-3 bg-[#ffdcbe] rounded-xl text-tertiary">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              star
            </span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1">
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="material-symbols-outlined text-xs text-tertiary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              star
            </span>
          ))}
          <span
            className="material-symbols-outlined text-xs text-tertiary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            star_half
          </span>
          <span className="text-xs text-on-surface-variant ml-2">
            Basé sur 128 avis
          </span>
        </div>
      </div>

      {/* Revenue card with sparkline bars */}
      <div className="bg-primary text-on-primary p-6 rounded-xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-sm font-medium opacity-80">Revenu Total (MTD)</p>
          <h3 className="text-3xl font-extrabold mt-2 font-headline">
            MGA 4.2M
          </h3>
          {/* Mini bar chart — heights represent weekly revenue trend */}
          <div className="mt-6 h-12 flex items-end gap-1">
            {[
              'h-4 bg-white/20',
              'h-8 bg-white/40',
              'h-6 bg-white/20',
              'h-10 bg-white/60',
              'h-5 bg-white/30',
              'h-12 bg-white/80',
              'h-7 bg-white/50',
            ].map((classes, i) => (
              <div key={i} className={`w-full rounded-t-sm ${classes}`} />
            ))}
          </div>
        </div>
        {/* Decorative glow */}
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
}
