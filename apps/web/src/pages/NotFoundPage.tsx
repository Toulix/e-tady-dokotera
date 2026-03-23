import { Link } from 'react-router-dom';

/**
 * Catch-all 404 page for unknown URLs.
 * Gives the user a clear way back to the homepage instead of a blank screen.
 */
export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-6">
      <div className="text-center space-y-4 max-w-md">
        <span className="material-symbols-outlined text-8xl text-outline-variant">
          explore_off
        </span>
        <h1 className="font-headline text-4xl font-extrabold text-on-surface">
          404
        </h1>
        <p className="text-on-surface-variant text-lg">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <Link
          to="/"
          className="inline-block mt-4 px-8 py-3 bg-primary text-on-primary font-bold rounded-full hover:brightness-110 transition-all"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
