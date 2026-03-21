import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { AxiosError } from 'axios';
import eyeIcon from '../../assets/eye_icon.svg';
import hidePasswordIcon from '../../assets/hide_password_icon.svg';
import arrowRightIcon from '../../assets/arrow_right_icon.svg';
import securedIcon from '../../assets/secured_icon.svg';
import speedIcon from '../../assets/Container.svg';

// Returns 1 (weak) | 2 (medium) | 3 (strong) — 0 means empty
function getPasswordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length === 0) return 0;
  if (pw.length < 8) return 1;
  const hasDigit = /\d/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  if (hasDigit && hasUpper && pw.length >= 12) return 3;
  if (hasDigit || hasUpper) return 2;
  return 1;
}

const STRENGTH_LABEL = ['', 'Faible', 'Moyen', 'Fort'] as const;
const STRENGTH_COLOR = ['', 'var(--color-on-error-container)', 'var(--color-on-surface-variant)', 'var(--color-primary-container)'] as const;
const STRENGTH_BAR_COLOR = ['', 'var(--color-on-error-container)', 'var(--color-outline)', 'var(--color-primary-container)'] as const;

export default function RegisterPage() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneSuffix, setPhoneSuffix] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(password);

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
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-on-surface)', fontFamily: 'var(--font-body)' }}
    >
      {/* Header */}
      <header
        className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 py-5"
        style={{ backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-primary-container)' }}
          >
            E-tady dokotera
          </span>
          <span
            className="h-4 w-px"
            style={{ backgroundColor: 'var(--color-outline-variant)', opacity: 0.4 }}
          />
          <span className="font-medium text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
            e-tady dokotera
          </span>
        </div>
        <button
          className="rounded-full p-2 hover:opacity-60 transition-opacity"
          style={{ color: 'var(--color-outline)' }}
          aria-label="Aide"
        >
          <img src={securedIcon} alt="" className="w-5 h-5" />
        </button>
      </header>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center pt-24 pb-12 px-6">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          {/* ── Left: editorial ── */}
          <div className="hidden lg:flex lg:col-span-5 flex-col gap-8">

            <div className="space-y-4">
              <span
                className="inline-flex px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase"
                style={{ backgroundColor: 'var(--color-secondary-container)', color: 'var(--color-on-surface-variant)' }}
              >
                Santé Madagascar
              </span>
              <h1
                className="text-5xl font-bold leading-[1.1] tracking-tight"
                style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
              >
                Rejoignez{' '}
                <span style={{ color: 'var(--color-primary-container)' }}>e-tady dokotera</span>
              </h1>
              <p className="text-xl max-w-md leading-relaxed" style={{ color: 'var(--color-on-surface-variant)' }}>
                Créez un compte pour trouver les meilleurs médecins à Madagascar. Profitez d'une expérience de santé à la fois professionnelle et humaine.
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-3">
              {[
                { iconSrc: securedIcon, label: 'Médecins Vérifiés' },
                { iconSrc: speedIcon, label: 'Réservation Rapide' },
              ].map(({ iconSrc, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-4 py-2 rounded-full"
                  style={{ backgroundColor: 'var(--color-surface-container-highest)', border: '1px solid var(--color-outline-variant)' }}
                >
                  <img src={iconSrc} alt="" className="w-5 h-5" />
                  <span className="text-sm font-semibold">{label}</span>
                </div>
              ))}
            </div>

            {/* Decorative hospital image */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBWS7HGOqL5B8C5I0uzf79rOutDo8uf6-AAUwibhS7xqNP92_m2Wyip_HM3834zE_40xju4iuLmExO0gY02KWPwGZiV96Ax6xxFgAEHBIsVW0hkoHXQgmdrdkVq2M3Bc2SF3JQ5cjRgJftjg3kbjo0azWwkoD3YNqtUjRtF5DalDTLbFolT6VOePdETDpnpChInEKjaXYjeIkvA5IGHMbuGnQ6NM6uCCBOJC9H1MIok7Epj0eKKOw0jton6fporgXGJQJtTw367eaXP"
                alt="Établissement médical moderne à Madagascar"
                className="w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top right, rgba(0,83,135,0.35), transparent)' }}
              />
            </div>
          </div>

          {/* ── Right: form card ── */}
          <div className="lg:col-span-7 flex justify-center lg:justify-end">
            <div
              className="w-full max-w-xl p-10 md:p-14 rounded-2xl relative overflow-hidden"
              style={{
                backgroundColor: 'var(--color-surface-container-lowest)',
                boxShadow: '0 40px 80px -20px rgba(25, 28, 32, 0.08)',
              }}
            >
              {/* Subtle top-right glow */}
              <div
                className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none -mr-20 -mt-20"
                style={{ backgroundColor: 'rgba(207,229,255,0.35)', filter: 'blur(50px)' }}
              />

              <form onSubmit={handleSubmit} className="space-y-6 relative z-10">

                {error && (
                  <div
                    className="rounded-xl p-4 text-sm"
                    style={{ backgroundColor: 'var(--color-error-container)', color: 'var(--color-on-error-container)' }}
                  >
                    {error}
                  </div>
                )}

                {/* Prénom + Nom */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Prénom" htmlFor="first_name">
                    <input
                      id="first_name"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jean"
                      className="field-input"
                    />
                  </Field>
                  <Field label="Nom" htmlFor="last_name">
                    <input
                      id="last_name"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Rakoto"
                      className="field-input"
                    />
                  </Field>
                </div>

                {/* Phone */}
                <Field label="Numéro de téléphone malgache" htmlFor="phone">
                  <div
                    className="flex items-center rounded-xl focus-within:ring-2 focus-within:ring-primary-container transition-all"
                    style={{ backgroundColor: 'var(--color-surface-container-highest)' }}
                  >
                    {/* +261 prefix is locked — users enter only the 9-digit suffix */}
                    <span
                      className="pl-5 pr-4 py-4 text-sm font-bold shrink-0 border-r"
                      style={{ color: 'var(--color-on-surface-variant)', borderColor: 'var(--color-outline-variant)' }}
                    >
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
                      onChange={(e) => setPhoneSuffix(e.target.value.replace(/\D/g, ''))}
                      placeholder="32 00 000 00"
                      className="flex-1 bg-transparent border-none outline-none pl-4 pr-5 py-4 text-sm"
                      style={{ color: 'var(--color-on-surface)' }}
                    />
                  </div>
                </Field>

                {/* Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="block text-[10px] font-bold uppercase tracking-widest ml-1"
                    style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                  >
                    Choisir un mot de passe
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="field-input pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center hover:opacity-60 transition-opacity"
                      style={{ color: 'var(--color-outline)' }}
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      <img src={showPassword ? hidePasswordIcon : eyeIcon} alt="" className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Hint + strength label */}
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px]" style={{ color: 'var(--color-outline)' }}>
                      Minimum 8 caractères avec au moins un chiffre.
                    </p>
                    {strength > 0 && (
                      <span
                        className="text-[10px] font-bold transition-colors"
                        style={{ color: STRENGTH_COLOR[strength] }}
                      >
                        {STRENGTH_LABEL[strength]}
                      </span>
                    )}
                  </div>

                  {/* Strength bar — 3 segments */}
                  {password.length > 0 && (
                    <div className="flex gap-1 px-1">
                      {([1, 2, 3] as const).map((bar) => (
                        <div
                          key={bar}
                          className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor:
                              bar <= strength
                                ? STRENGTH_BAR_COLOR[strength]
                                : 'var(--color-surface-container-highest)',
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* CTA */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-full py-5 font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: 'var(--color-primary-container)',
                      color: 'var(--color-on-primary)',
                      fontFamily: 'var(--font-headline)',
                      boxShadow: '0 8px 24px rgba(27,108,168,0.25)',
                    }}
                  >
                    {loading ? 'Inscription en cours…' : 'Créer un compte'}
                    {!loading && <img src={arrowRightIcon} alt="" className="w-4 h-4" />}
                  </button>
                </div>

                {/* Login link */}
                <p className="text-center text-sm pt-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                  Vous avez déjà un compte ?{' '}
                  <Link
                    to="/auth/login"
                    className="font-bold hover:underline"
                    style={{ color: 'var(--color-primary-container)' }}
                  >
                    Se connecter
                  </Link>
                </p>
              </form>

              {/* Footer links */}
              <div
                className="mt-12 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold tracking-widest uppercase"
                style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-outline)', opacity: 0.6 }}
              >
                <div className="flex gap-6">
                  <a href="#" className="hover:opacity-70 transition-opacity">Conditions d'utilisation</a>
                  <a href="#" className="hover:opacity-70 transition-opacity">Politique de confidentialité</a>
                </div>
                <div style={{ color: 'var(--color-outline-variant)' }}>© 2024 e-tady dokotera</div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Bottom accent line — echoes the Stitch gradient bar */}
      <div
        className="fixed bottom-0 left-0 w-full h-1 pointer-events-none"
        style={{
          background: 'linear-gradient(to right, var(--color-primary-container), #ffb86f, var(--color-primary))',
          opacity: 0.3,
        }}
      />
    </div>
  );
}

// Lightweight label wrapper so the form stays scannable
function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-[10px] font-bold uppercase tracking-widest ml-1"
        style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
