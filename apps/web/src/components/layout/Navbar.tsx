import { Link } from 'react-router-dom';

export function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 glass-nav shadow-sm h-20">
      <div className="flex justify-between items-center max-w-7xl mx-auto px-8 h-full">
        {/* Brand */}
        <Link
          to="/"
          className="text-2xl font-extrabold text-primary tracking-tighter font-headline"
        >
          e-tady dokotera
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-x-10 font-medium text-sm uppercase tracking-wider">
          <Link to="/search" className="text-primary font-bold">
            Trouver un Docteur
          </Link>
          <a href="#" className="text-outline hover:text-primary transition-colors">
            Pour les Docteurs
          </a>
          <a href="#" className="text-outline hover:text-primary transition-colors">
            À propos
          </a>
          <a href="#" className="text-outline hover:text-primary transition-colors">
            Contact
          </a>
        </div>

        {/* Auth buttons */}
        <div className="flex items-center gap-4">
          <Link
            to="/auth/login"
            className="px-6 py-2.5 rounded-full text-primary font-semibold hover:bg-surface-container transition-all"
          >
            Se connecter
          </Link>
          <Link
            to="/auth/register"
            className="px-8 py-2.5 rounded-full bg-primary text-on-primary font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
          >
            S'inscrire
          </Link>
        </div>
      </div>
    </nav>
  );
}
