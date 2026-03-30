import StatsCards from '../../components/doctor-dashboard/StatsCards';
import TodaySchedule from '../../components/doctor-dashboard/TodaySchedule';
import QuickActions from '../../components/doctor-dashboard/QuickActions';
import PendingRequests from '../../components/doctor-dashboard/PendingRequests';
import RecentReviews from '../../components/doctor-dashboard/RecentReviews';

/**
 * Doctor dashboard — the first screen a doctor sees after login.
 * Static layout matching the Stitch design; data will be wired to the API later.
 *
 * Layout: 12-column grid
 *   - Left column (4 cols): stacked stat cards
 *   - Right column (8 cols): today's schedule + quick actions
 *   - Full width row: pending requests + recent reviews side by side
 */
export default function DoctorDashboardPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Hero header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-on-surface tracking-tight font-headline">
            Bonjour, Dr. Rakoto
          </h1>
          <p className="text-on-surface-variant mt-1">
            Voici le résumé de votre activité pour aujourd'hui.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-primary">
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <p className="text-xs text-on-surface-variant">
            Antananarivo, Madagascar
          </p>
        </div>
      </div>

      {/* Main grid: stats on the left, schedule + actions on the right */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <StatsCards />
        </div>

        <div className="col-span-12 md:col-span-8 space-y-6">
          <TodaySchedule />
          <QuickActions />
        </div>
      </div>

      {/* Bottom row: requests + reviews */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PendingRequests />
        <RecentReviews />
      </div>
    </div>
  );
}
