import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { AxiosError } from 'axios';
import medicalPlusIcon from '../../assets/medical_plus_Icon.svg';
import securedIcon from '../../assets/secured_icon.svg';
import scheduleIcon from '../../assets/Container.svg';
import phoneIcon from '../../assets/Phone_icon.svg';
import lockIcon from '../../assets/lock_icon.svg';
import eyeIcon from '../../assets/eye_icon.svg';
import hidePasswordIcon from '../../assets/hide_password_icon.svg';
import arrowRightIcon from '../../assets/arrow_right_icon.svg';
import locationIcon from '../../assets/location_icon.svg';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [phoneSuffix, setPhoneSuffix] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const phoneNumber = `+261${phoneSuffix}`;

    if (phoneSuffix.length !== 9) {
      setError('Le numéro doit contenir 9 chiffres après +261');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login', {
        phone_number: phoneNumber,
        password,
      });

      const { access_token, user } = res.data.data;

      // The refresh token is automatically set as an httpOnly cookie by the API.
      // Access token is stored in Zustand memory only — never localStorage.
      setAuth(
        {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
        },
        access_token,
      );

      navigate('/patient/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof AxiosError) {
        const msg = err.response?.data?.error?.message;
        if (err.response?.status === 401) {
          setError('Numéro de téléphone ou mot de passe incorrect');
        } else if (err.response?.status === 429) {
          setError('Trop de tentatives. Veuillez réessayer plus tard.');
        } else if (Array.isArray(msg)) {
          setError(msg[0]);
        } else if (msg) {
          setError(msg);
        } else {
          setError('Une erreur est survenue. Veuillez réessayer.');
        }
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', fontFamily: 'var(--font-body)' }}>

      {/* Header */}
      <header className="w-full px-8 py-8 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
            <img src={medicalPlusIcon} alt="" className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)' }}>
            e-tady dokotera
          </span>
        </div>
        <div className="hidden md:block">
          <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Besoin d'aide ?</span>
          <a href="#" className="font-bold ml-2 hover:underline text-sm" style={{ color: 'var(--color-primary)' }}>Support</a>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow flex items-center justify-center px-6 pb-20">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">

          {/* Left panel — brand / hero */}
          <div
            className="hidden lg:flex lg:col-span-7 relative overflow-hidden rounded-2xl p-12 flex-col justify-between"
            style={{ backgroundColor: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)' }}
          >
            {/* Radial highlight */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, #ffffff 0%, transparent 70%)' }}
            />
            {/* Decorative blur circle */}
            <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full pointer-events-none" style={{ backgroundColor: '#1B6CA8', filter: 'blur(60px)', opacity: 0.5 }} />

            <div className="relative z-10">
              <span
                className="px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase mb-8 inline-block"
                style={{ backgroundColor: 'rgba(190,225,254,0.25)' }}
              >
                Réseau de Santé de Madagascar
              </span>
              <h1 className="text-5xl font-extrabold leading-tight tracking-tighter mb-6" style={{ fontFamily: 'var(--font-headline)' }}>
                Allier Soins <br />
                et <span className="text-white">Compassion.</span>
              </h1>
            </div>

            <div className="relative z-10 grid grid-cols-2 gap-4">
              <div className="p-6 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
                <img src={securedIcon} alt="" className="w-6 h-6 mb-3" />
                <h3 className="font-bold text-lg mb-1">Accès Sécurisé</h3>
                <p className="text-sm opacity-80">Un chiffrement qui protège vos données médicales.</p>
              </div>
              <div className="p-6 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
                <img src={scheduleIcon} alt="" className="w-6 h-6 mb-3" />
                <h3 className="font-bold text-lg mb-1">Prise de RDV Rapide</h3>
                <p className="text-sm opacity-80">Confirmation instantanée avec les meilleurs médecins malgaches.</p>
              </div>
            </div>
          </div>

          {/* Right panel — login form */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div
              className="rounded-2xl p-8 md:p-12"
              style={{
                backgroundColor: 'var(--color-surface-container-lowest)',
                boxShadow: '0 40px 80px -20px rgba(25, 28, 32, 0.08)',
              }}
            >
              <div className="mb-10">
                <h2 className="text-3xl font-bold mb-3 tracking-tight" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
                  Bienvenue à nouveau chez e-tady dokotera
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                  Accédez à votre compte médical et gérez vos rendez-vous facilement.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">

                {error && (
                  <div
                    className="rounded-xl p-4 text-sm"
                    style={{ backgroundColor: 'var(--color-error-container)', color: 'var(--color-on-error-container)' }}
                  >
                    {error}
                  </div>
                )}

                {/* Phone number */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="phone"
                    className="text-xs font-bold tracking-wider uppercase ml-1 block"
                    style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                  >
                    Numéro de téléphone
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <img src={phoneIcon} alt="" className="w-5 h-5" />
                    </div>
                    {/* +261 inline prefix + 9-digit suffix in a single styled row */}
                    <div
                      className="flex items-center rounded-xl pl-12 pr-4"
                      style={{ backgroundColor: 'var(--color-surface-container-highest)' }}
                    >
                      <span className="text-sm font-medium shrink-0 py-4 pr-1" style={{ color: 'var(--color-on-surface)' }}>+261</span>
                      <input
                        id="phone"
                        type="tel"
                        required
                        inputMode="numeric"
                        pattern="[0-9]{9}"
                        maxLength={9}
                        value={phoneSuffix}
                        onChange={(e) => setPhoneSuffix(e.target.value.replace(/\D/g, ''))}
                        className="flex-1 bg-transparent border-none outline-none py-4 text-sm focus:ring-0"
                        style={{ color: 'var(--color-on-surface)' }}
                        placeholder="34 00 000 00"
                      />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label
                      htmlFor="password"
                      className="text-xs font-bold tracking-wider uppercase"
                      style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                    >
                      Mot de passe
                    </label>
                    <a href="#" className="text-xs font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>
                      Mot de passe oublié ?
                    </a>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <img src={lockIcon} alt="" className="w-5 h-5" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border-none py-4 pl-12 pr-12 text-sm focus:ring-2 focus:outline-none transition-all"
                      style={{
                        backgroundColor: 'var(--color-surface-container-highest)',
                        color: 'var(--color-on-surface)',
                      }}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--color-outline)' }}
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      <img src={showPassword ? hidePasswordIcon : eyeIcon} alt="" className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full py-4 font-bold flex items-center justify-center gap-2 mt-8 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    fontFamily: 'var(--font-headline)',
                    boxShadow: '0 8px 24px rgba(0,83,135,0.25)',
                  }}
                >
                  {loading ? 'Connexion...' : 'Se connecter'}
                  {!loading && <img src={arrowRightIcon} alt="" className="w-4 h-4" />}
                </button>
              </form>

              {/* Footer */}
              <div className="mt-10 text-center">
                <p className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                  Pas encore de compte ?{' '}
                  <Link to="/auth/register" className="font-bold ml-1 hover:underline" style={{ color: 'var(--color-primary)' }}>
                    Créer un compte
                  </Link>
                </p>
              </div>
            </div>

            {/* Regional cities */}
            <div className="mt-8 flex items-center justify-center gap-6 opacity-40 hover:opacity-70 transition-opacity duration-500">
              {['Antananarivo', 'Toamasina', 'Mahajanga'].map((city) => (
                <div key={city} className="flex items-center gap-1.5">
                  <img src={locationIcon} alt="" className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase tracking-tight">{city}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* Background decorative blob */}
      <div className="fixed bottom-0 right-0 -z-10 w-1/3 h-1/2 opacity-30 pointer-events-none">
        <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path
            d="M47.7,-63.2C61.4,-54.1,71.8,-39.1,76.5,-22.8C81.2,-6.5,80.1,11,73.4,26.5C66.7,42,54.4,55.5,39.4,64.4C24.4,73.3,6.7,77.5,-10.1,75.2C-26.9,72.9,-42.8,64,-55.1,51.2C-67.4,38.4,-76,21.7,-77.8,4.1C-79.6,-13.5,-74.6,-32.1,-63,-42.4C-51.4,-52.7,-33.2,-54.7,-17.8,-60.9C-2.4,-67,10.2,-77.3,47.7,-63.2Z"
            fill="var(--color-secondary-container)"
            transform="translate(200 200)"
          />
        </svg>
      </div>

    </div>
  );
}
