import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/shared/ErrorBoundary';
import AppShell from './components/layout/AppShell';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

// Lazy-loaded routes — each becomes its own chunk so the initial bundle
// only contains the homepage. Especially important for users on slow
// Malagasy mobile networks where every KB counts.
const SearchPage = lazy(() => import('./pages/SearchPage'));
const DoctorProfilePage = lazy(() => import('./pages/DoctorProfilePage'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const BookingSuccessPage = lazy(() => import('./pages/BookingSuccessPage'));
const PatientDashboard = lazy(() => import('./pages/patient/DashboardPage'));
const DoctorDashboard = lazy(() => import('./pages/doctor/DashboardPage'));
const SchedulePage = lazy(() => import('./pages/doctor/SchedulePage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const VerifyOtpPage = lazy(() => import('./pages/auth/VerifyOtpPage'));
const TechStackWikiPage = lazy(() => import('./pages/wiki/TechStackWikiPage'));

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-outline-variant border-t-primary animate-spin mx-auto" />
        <p className="text-outline text-sm">Chargement...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* Standalone routes — no Navbar, own layout */}
            <Route path="/wiki" element={<TechStackWikiPage />} />
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/register" element={<RegisterPage />} />
            <Route path="/auth/verify-otp" element={<VerifyOtpPage />} />

            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/doctors/:id" element={<DoctorProfilePage />} />
              <Route path="/booking/:doctorId" element={<BookingPage />} />
              <Route path="/booking/success" element={<BookingSuccessPage />} />
              <Route path="/patient/dashboard" element={<PatientDashboard />} />
              <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
              <Route path="/doctor/schedule" element={<SchedulePage />} />
            </Route>

            {/* Catch-all for unknown URLs */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
