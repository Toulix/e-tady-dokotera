import { Link } from 'react-router-dom';
import { useState } from 'react';


export default function Footer() {
  const [email, setEmail] = useState('');

  return (
    <footer className="bg-on-primary-fixed-variant text-white py-20 px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        {/* Brand */}
        <div className="space-y-6">
          <div className="text-2xl font-extrabold tracking-tighter font-headline">
            e-tady dokotera
          </div>
          <p className="text-blue-100/60 text-sm leading-relaxed">
            Première plateforme de santé digitale à Madagascar. Nous connectons
            les patients aux praticiens avec transparence et rapidité.
          </p>
        </div>

        {/* Services */}
        <div>
          <h5 className="font-bold mb-6 text-on-primary-container">Services</h5>
          <ul className="space-y-3 text-sm text-blue-100/60">
            <li>
              <Link to="/search" className="hover:text-white transition-colors">
                Trouver un docteur
              </Link>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Téléconsultation
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Urgences
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Logiciel cabinet
              </a>
            </li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h5 className="font-bold mb-6 text-on-primary-container">Légal</h5>
          <ul className="space-y-3 text-sm text-blue-100/60">
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Mentions légales
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Confidentialité
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                CGU
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Cookies
              </a>
            </li>
          </ul>
        </div>

        {/* Newsletter */}
        <div>
          <h5 className="font-bold mb-6 text-on-primary-container">Newsletter</h5>
          <p className="text-sm text-blue-100/60 mb-4">
            Recevez nos conseils santé mensuels.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              // Newsletter subscription will be wired to API later
              setEmail('');
            }}
            className="flex gap-2"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Votre email"
              className="bg-white/10 border-none rounded-full px-4 text-sm w-full focus:ring-2 focus:ring-on-primary-container"
            />
            <button
              type="submit"
              className="bg-on-primary-container text-on-primary-fixed-variant p-2 rounded-full hover:brightness-110 cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </form>
        </div>
      </div>

      {/* Copyright */}
      <div className="max-w-7xl mx-auto border-t border-white/10 mt-20 pt-8 text-center text-[10px] text-blue-100/40 uppercase tracking-widest font-bold">
        &copy; 2026 e-tady dokotera &bull; Madagascar Digital Health Initiative
      </div>
    </footer>
  );
}
