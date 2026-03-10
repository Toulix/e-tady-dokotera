import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import DoctorProfilePage from './pages/DoctorProfilePage';
import BookingPage from './pages/BookingPage';
import BookingSuccessPage from './pages/BookingSuccessPage';
import PatientDashboard from './pages/patient/DashboardPage';
import DoctorDashboard from './pages/doctor/DashboardPage';
import SchedulePage from './pages/doctor/SchedulePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import VerifyOtpPage from './pages/auth/VerifyOtpPage';
import TechStackWikiPage from './pages/wiki/TechStackWikiPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone route — wiki has its own layout */}
        <Route path="/wiki" element={<TechStackWikiPage />} />

        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/doctors/:id" element={<DoctorProfilePage />} />
          <Route path="/booking/:doctorId" element={<BookingPage />} />
          <Route path="/booking/success" element={<BookingSuccessPage />} />
          <Route path="/patient/dashboard" element={<PatientDashboard />} />
          <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
          <Route path="/doctor/schedule" element={<SchedulePage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="/auth/verify-otp" element={<VerifyOtpPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
