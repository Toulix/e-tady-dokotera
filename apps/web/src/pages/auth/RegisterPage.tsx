import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { AxiosError } from 'axios';

export default function RegisterPage() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/register', {
        phone_number: phoneNumber,
        password,
        first_name: firstName,
        last_name: lastName,
        user_type: 'patient',
      });

      // Registration succeeded — redirect to OTP verification with the phone number
      // so the VerifyOtpPage knows which account to verify
      navigate('/auth/verify-otp', { state: { phoneNumber } });
    } catch (err) {
      if (err instanceof AxiosError) {
        const msg = err.response?.data?.error?.message;
        if (err.response?.status === 409) {
          setError('Ce numéro de téléphone est déjà enregistré');
        } else if (Array.isArray(msg)) {
          // NestJS validation pipes return an array of error strings
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
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Créer un compte</h1>
          <p className="mt-2 text-sm text-gray-600">
            Inscrivez-vous pour prendre rendez-vous avec un médecin
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                Prénom
              </label>
              <input
                id="firstName"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                placeholder="Jean"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                Nom
              </label>
              <input
                id="lastName"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                placeholder="Rakoto"
              />
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Numéro de téléphone
            </label>
            <div className="mt-1 flex">
              {/* +261 prefix is locked — users can only enter the 9-digit suffix */}
              <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
                +261
              </span>
              <input
                id="phone"
                type="tel"
                required
                inputMode="numeric"
                pattern="[0-9]{9}"
                maxLength={9}
                value={phoneSuffix}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setPhoneSuffix(digits);
                }}
                className="block w-full rounded-r-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                placeholder="XX XXX XXXX"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Mot de passe
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                placeholder="8 caractères minimum"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-gray-500 hover:text-gray-700"
              >
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Inscription en cours...' : "S'inscrire"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Déjà un compte ?{' '}
          <Link to="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
