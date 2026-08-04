// src/HomePage.jsx
import React from 'react';
import { login, getKeycloak } from './keycloak-init';
import { 
  Calendar, 
  Shield, 
  Clock, 
  ArrowRight,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';

export default function HomePage() {
  const specialties = [
    'Cardiologie',
    'Gynécologie',
    'Ophtalmologie',
    'Pédiatrie',
    'Dermatologie',
    'Médecine générale',
    'Kinésithérapeute',
    'ORL',
    'Psychiatre',
    'Chirurgien orthopédique'
  ];

  const stats = [
    { value: '50+', label: 'Médecins disponibles' },
    { value: '1000+', label: 'Patients satisfaits' },
    { value: '24/7', label: 'Service disponible' },
    { value: '100%', label: 'Sécurisé' }
  ];

  const handleLogin = (e) => {
    e.preventDefault();
    login();
  };

  const handleRegister = (e) => {
    e.preventDefault();
    const kc = getKeycloak();
    sessionStorage.clear();
    kc.register({
      redirectUri: window.location.origin
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] font-['Poppins']">
      {/* SECTION HERO */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('/src/assets/background-medical.jpg')`,
          }}
        />
        <div className="absolute inset-0 bg-[#0D1B3D]/80" />
        
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white font-black text-4xl border border-white/20">
              M
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-4">
            MediGo
            <span className="block text-[#2EAF5E]">Prenez rendez-vous avec votre médecin en ligne</span>
          </h1>
          
          <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Rapide, gratuit et sécurisé. Trouvez un professionnel de santé et réservez votre consultation en quelques clics.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mb-8">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <p className="text-2xl md:text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-white/70">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={handleLogin}
              className="px-8 py-4 bg-[#2EAF5E] hover:bg-[#25934f] text-white font-bold rounded-xl transition text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              Se connecter
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRegister}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white font-bold rounded-xl transition text-sm border border-white/20 cursor-pointer"
            >
              Créer un compte
            </button>
          </div>
        </div>
      </section>

      {/* SECTION SPÉCIALITÉS */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-[#0D1B3D] mb-4">
            Spécialités médicales disponibles
          </h2>
          <p className="text-center text-gray-500 mb-8">
            Consultez les professionnels de santé dans différentes spécialités
          </p>
          
          <div className="flex flex-wrap justify-center gap-3">
            {specialties.map((spec, index) => (
              <span
                key={index}
                className="px-4 py-2 bg-[#F5F7FA] text-[#0D1B3D] rounded-full text-sm font-medium hover:bg-[#0D1B3D] hover:text-white transition cursor-pointer"
              >
                {spec}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION AVANTAGES */}
      <section className="py-16 px-4 bg-[#F5F7FA]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-[#0D1B3D] mb-12">
            Pourquoi choisir MediGo ?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="w-16 h-16 bg-[#2EAF5E]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-[#2EAF5E]" />
              </div>
              <h3 className="text-lg font-bold text-[#0D1B3D] mb-2">Prise de RDV rapide</h3>
              <p className="text-sm text-gray-500">
                Réservez votre consultation en ligne en quelques clics, 24h/24 et 7j/7.
              </p>
            </div>

            <div className="text-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-bold text-[#0D1B3D] mb-2">100% sécurisé</h3>
              <p className="text-sm text-gray-500">
                Vos données sont protégées et vos paiements sont sécurisés via FedaPay.
              </p>
            </div>

            <div className="text-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className="text-lg font-bold text-[#0D1B3D] mb-2">Rappels automatiques</h3>
              <p className="text-sm text-gray-500">
                Recevez un SMS ou un email de rappel 24h avant votre rendez-vous.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION CTA FINAL */}
      <section className="py-16 px-4 bg-[#0D1B3D]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Prêt à prendre rendez-vous ?
          </h2>
          <p className="text-white/70 mb-8">
            Rejoignez des milliers de patients qui utilisent MediGo pour gérer leurs consultations médicales.
          </p>
          <button
            type="button"
            onClick={handleLogin}
            className="px-8 py-4 bg-[#2EAF5E] hover:bg-[#25934f] text-white font-bold rounded-xl transition text-sm cursor-pointer"
          >
            Commencer maintenant
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0A1529] text-white/60 py-8 px-4 border-t border-white/5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#2EAF5E] rounded-lg flex items-center justify-center text-white font-bold text-sm">
                M
              </div>
              <span className="text-white font-bold">MediGo</span>
            </div>
            <p className="text-sm">
              La plateforme de prise de rendez-vous médicaux moderne et sécurisée.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Liens utiles</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition">Accueil</a></li>
              <li><a href="#" className="hover:text-white transition">À propos</a></li>
              <li><a href="#" className="hover:text-white transition">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Mail className="w-4 h-4" /> contact@medigo.bj</li>
              <li className="flex items-center gap-2"><Phone className="w-4 h-4" /> +229 01 53 97 29 03</li>
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Cotonou, Bénin</li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Légal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition">CGU</a></li>
              <li><a href="#" className="hover:text-white transition">Mentions légales</a></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-white/5 text-center text-sm">
          © 2026 MediGo - Tous droits réservés.
        </div>
      </footer>
    </div>
  );
}