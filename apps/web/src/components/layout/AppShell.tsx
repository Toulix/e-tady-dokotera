import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export default function AppShell() {
  return (
    <div>
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
