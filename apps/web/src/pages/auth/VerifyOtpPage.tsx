import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { AxiosError } from 'axios';

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

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      // Move back to previous input on backspace when current is empty
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== OTP_LENGTH) {
      setError('Veuillez saisir les 6 chiffres');
      return;
    }
    submitOtp(code);
  }

  // Mask phone for display: +261 XX XXX XX34 → show last 2 digits
  const maskedPhone = phoneNumber.slice(0, -2).replace(/./g, '*') + phoneNumber.slice(-2);

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vérification OTP</h1>
          <p className="mt-2 text-sm text-gray-600">
            Entrez le code à 6 chiffres envoyé au{' '}
            <span className="font-medium text-gray-900">{maskedPhone}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-center gap-3">
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
                className="h-14 w-12 rounded-md border border-gray-300 text-center text-xl font-semibold text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
                aria-label={`Chiffre ${i + 1}`}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || digits.some((d) => !d)}
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Vérification...' : 'Vérifier'}
          </button>
        </form>

        <p className="text-sm text-gray-500">
          Le code expire dans 10 minutes
        </p>
      </div>
    </div>
  );
}
