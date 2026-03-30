import { Outlet } from 'react-router-dom';
import DoctorSidebar from './DoctorSidebar';
import DoctorHeader from './DoctorHeader';
import { useIdleLogout } from '../../hooks/useIdleLogout';

/**
 * Layout shell for all doctor-facing pages.
 * Replaces AppShell (Navbar + Footer) with a persistent sidebar + top header.
 * The sidebar is fixed at 256px (w-64), and the main content scrolls independently.
 */
export default function DoctorShell() {
  useIdleLogout();

  return (
    <div className="min-h-screen bg-surface">
      <DoctorSidebar />
      <div className="ml-64 min-h-screen">
        <DoctorHeader />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
