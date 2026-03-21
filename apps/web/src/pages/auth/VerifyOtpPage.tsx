import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { AxiosError } from 'axios';
import medicalPlusIcon from '../../assets/medical_plus_Icon.svg';
import securityHeartIcon from '../../assets/security_heart_icon.svg';
import securedIcon from '../../assets/security_white_icon.svg';
import conformIcon from '../../assets/conform_icon.svg';
import lockIcon from '../../assets/lock_icon.svg';
import arrowRightIcon from '../../assets/arrow_right_icon.svg';

const OTP_LENGTH = 6;

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);

  // Phone number passed from RegisterPage via router state
  const phoneNumber = (location.state as { phoneNumber?: string })?.phoneNumber;

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus the first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // If no phone number in state, the user navigated here directly — redirect to register
  if (!phoneNumber) {
    return <Navigate to="/auth/register" replace />;
  }

  function updateDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');

    // Auto-advance to next input on keystroke
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are filled
    if (digit && index === OTP_LENGTH - 1 && next.every((d) => d !== '')) {
      submitOtp(next.join(''));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      // Move back to previous input on backspace when current is empty
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;

    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);

    // Focus the input after the last pasted digit, or the last one
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();

    if (next.every((d) => d !== '')) {
      submitOtp(next.join(''));
    }
  }

  async function submitOtp(code: string) {
    setLoading(true);
    setError('');

    try {
      const res = await apiClient.post('/auth/verify-otp', {
        phone_number: phoneNumber,
        code,
      });

      const { access_token, user } = res.data.data;

      // The refresh token is automatically set as an httpOnly cookie by the API.
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
        if (err.response?.status === 429) {
          setError('Trop de tentatives. Veuillez demander un nouveau code.');
        } else if (Array.isArray(msg)) {
          setError(msg[0]);
        } else if (msg) {
          setError(msg);
        } else {
          setError('Code invalide. Veuillez réessayer.');
        }
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.');
      }
      // Clear inputs so the user can retry
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== OTP_LENGTH) {
      setError('Veuillez saisir les 6 chiffres');
      return;
    }
    submitOtp(code);
  }

  // Mask phone for display: show only last 2 digits
  const maskedPhone = phoneNumber.slice(0, -2).replace(/./g, '*') + phoneNumber.slice(-2);

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
        <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-12 items-center"
          style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            boxShadow: '0 40px 40px rgba(25, 28, 32, 0.06)',
            borderRadius: '1.5rem',
            overflow: 'hidden',
            padding: '2rem',
          }}>

          {/* Left panel — brand / content */}
          <div className="flex flex-col space-y-10 p-6 lg:p-10">
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-extrabold text-2xl tracking-tight" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)' }}>
                <img src={medicalPlusIcon} alt="" className="w-8 h-8" />
                <span>e-tady dokotera</span>
              </div>
              <span
                className="inline-flex items-center px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase"
                style={{ backgroundColor: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)' }}
              >
                Vérification Requise
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl font-bold leading-tight tracking-tight" style={{ fontFamily: 'var(--font-headline)' }}>
                Vérifiez votre téléphone
              </h1>
              <p className="text-lg leading-relaxed max-w-md" style={{ color: 'var(--color-on-surface-variant)' }}>
                Entrez le code à 6 chiffres envoyé à votre numéro de téléphone malgache. Cela nous aide à garantir que votre compte reste privé et sécurisé.
              </p>
              {phoneNumber && (
                <p className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                  Code envoyé au {maskedPhone}
                </p>
              )}
            </div>

            {/* Secure access visual card */}
            <div
              className="relative w-full rounded-2xl overflow-hidden flex items-center justify-center"
              style={{
                aspectRatio: '16 / 9',
                backgroundColor: 'var(--color-primary-fixed)',
              }}
            >
              <div
                className="absolute inset-0"
                style={{ backgroundImage: 'linear-gradient(135deg, rgba(0,83,135,0.2) 0%, rgba(118,68,0,0.1) 100%)' }}
              />
              <div className="relative z-10 flex flex-col items-center gap-4">
                <div
                  className="p-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(16px)' }}
                >
                  <img src={securedIcon} alt="" className="w-16 h-16" />
                </div>
                <p className="font-bold tracking-widest uppercase text-sm" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary)' }}>
                  ACCÈS SÉCURISÉ
                </p>
              </div>
            </div>
          </div>

          {/* Right panel — OTP form */}
          <div
            className="rounded-2xl p-12 lg:p-16 flex flex-col items-center justify-center text-center space-y-12"
            style={{ backgroundColor: 'var(--color-surface-container-low)' }}
          >
            {/* Shield with heart icon */}
            <div
              className="w-20 h-20 flex items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--color-primary-fixed)' }}
            >
              <img src={securityHeartIcon} alt="" className="w-10 h-10" />
            </div>

            <div className="w-full space-y-8">
              {error && (
                <div
                  className="rounded-xl p-4 text-sm text-left"
                  style={{ backgroundColor: 'var(--color-error-container)', color: 'var(--color-on-error-container)' }}
                >
                  {error}
                </div>
              )}

              {/* OTP digit inputs */}
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="flex justify-center gap-3 lg:gap-5">
                  {digits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => updateDigit(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      onPaste={i === 0 ? handlePaste : undefined}
                      disabled={loading}
                      aria-label={`Chiffre ${i + 1} du code`}
                      className="w-14 h-20 lg:w-16 lg:h-24 text-center text-2xl font-bold border-none rounded-xl outline-none transition-all disabled:opacity-50 focus:ring-2 focus:ring-primary-container"
                      style={{
                        fontFamily: 'var(--font-headline)',
                        backgroundColor: digit ? 'var(--color-surface-container-lowest)' : 'var(--color-surface-container-highest)',
                        color: 'var(--color-on-surface)',
                        boxShadow: digit ? '0 0 0 2px var(--color-primary-container)' : 'none',
                      }}
                    />
                  ))}
                </div>

                <div className="space-y-4">
                  <button
                    type="submit"
                    disabled={loading || digits.some((d) => !d)}
                    className="w-full rounded-full py-5 font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: 'var(--color-primary-container)',
                      color: 'var(--color-on-primary)',
                      fontFamily: 'var(--font-headline)',
                      boxShadow: '0 8px 24px rgba(0,83,135,0.25)',
                    }}
                  >
                    <span>{loading ? 'Vérification...' : 'Vérifier le code'}</span>
                    {!loading && <img src={arrowRightIcon} alt="" className="w-4 h-4" />}
                  </button>

                  <p className="text-sm font-medium" style={{ color: 'var(--color-on-surface-variant)' }}>
                    Vous n'avez pas reçu de code ?{' '}
                    <a
                      href="#"
                      className="font-bold hover:underline underline-offset-4 ml-1"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      Renvoyer le code
                    </a>
                  </p>
                </div>
              </form>
            </div>

            {/* Trust badges */}
            <div
              className="pt-8 flex flex-col items-center space-y-4 w-full"
              style={{ borderTop: '1px solid var(--color-outline-variant)', opacity: 0.6 }}
            >
              <div className="flex items-center gap-4 flex-wrap justify-center">
                <div className="flex items-center gap-1.5">
                  <img src={lockIcon} alt="" className="w-4 h-4" />
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ fontFamily: 'var(--font-label)' }}>
                    Chiffrement de bout en bout
                  </span>
                </div>
                <div className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--color-outline)' }} />
                <div className="flex items-center gap-1.5">
                  <img src={conformIcon} alt="" className="w-4 h-4" />
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ fontFamily: 'var(--font-label)' }}>
                    Conforme à la protection de la vie privée
                  </span>
                </div>
              </div>
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
