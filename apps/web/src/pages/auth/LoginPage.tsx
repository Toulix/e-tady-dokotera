import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { AxiosError } from 'axios';

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
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Se connecter</h1>
          <p className="mt-2 text-sm text-gray-600">
            Accédez à votre compte pour gérer vos rendez-vous
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Numéro de téléphone
            </label>
            <div className="mt-1 flex">
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
                placeholder="Votre mot de passe"
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
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Pas encore de compte ?{' '}
          <Link to="/auth/register" className="font-medium text-blue-600 hover:text-blue-500">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}
