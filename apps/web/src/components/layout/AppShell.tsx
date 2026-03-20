import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { useIdleLogout } from '../../hooks/useIdleLogout';

export default function AppShell() {
  useIdleLogout();

  return (
    <div>
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
