import React, { useState, useEffect, useRef } from 'react';
import keycloak, { login, logout } from './keycloak-init';
import PatientBooking from './PatientBooking';
import SecretaryDashboard from './SecretaryDashboard';
import PatientAppointmentsList from './PatientAppointmentsList';
import PatientProfile from './PatientProfile';
import PaymentCallback from './PaymentCallback';
import AdminDashboard from './AdminDashboard';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Erreur interceptée par le bouclier :", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-red-50 border border-red-200 rounded-2xl text-center font-['Poppins']">
          <h2 className="text-red-700 font-bold text-lg mb-2">🔴 Erreur de rendu détectée</h2>
          <p className="text-sm text-red-600 bg-white p-4 rounded-lg border border-red-100 text-left font-mono overflow-auto max-h-40 mb-4">
            {this.state.error?.toString()}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-[#0D1B3D] text-[#FFFFFF] px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-opacity-90 transition"
          >
            Recharger l'application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // Utiliser le statut global de Keycloak
  const [authenticated, setAuthenticated] = useState(keycloak.authenticated || false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(window.keycloakError || null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const initAttempted = useRef(false);

  // Fonction de connexion manuelle
  const handleLogin = () => {
    console.log("🔐 Tentative de connexion vers Keycloak...");
    login();
  };

  // Vérifier le statut d'authentification
  useEffect(() => {
    // Vérifier si l'utilisateur est authentifié via Keycloak
    if (keycloak.authenticated !== undefined) {
      setAuthenticated(keycloak.authenticated);
    }
    
    // Si une erreur globale existe
    if (window.keycloakError) {
      setAuthError(window.keycloakError);
    }
  }, []);

  // Route spéciale pour PaymentCallback
  if (window.location.pathname.startsWith('/payment-callback')) {
    return <PaymentCallback />;
  }

  // Erreur d'authentification
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-200 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🔴</div>
          <h2 className="text-xl font-bold text-red-600 mb-2">Erreur de connexion</h2>
          <p className="text-sm text-gray-600 mb-4">{authError}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#0D1B3D] text-white py-2.5 rounded-xl font-bold text-sm hover:bg-opacity-90 transition"
            >
              Réessayer
            </button>
            <button
              onClick={handleLogin}
              className="w-full bg-[#2EAF5E] text-white py-2.5 rounded-xl font-bold text-sm hover:bg-opacity-90 transition"
            >
              Se connecter manuellement
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Non authentifié - Afficher le bouton de connexion
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#0D1B3D] rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-4">
            M
          </div>
          <h1 className="text-2xl font-bold text-[#0D1B3D] mb-2">Accès restreint</h1>
          <p className="text-gray-500 text-sm mb-6">
            Vous devez être connecté via Keycloak pour accéder à Medigo.
          </p>
          <button
            onClick={handleLogin}
            className="w-full bg-[#0D1B3D] text-white py-3 rounded-xl font-bold text-sm hover:bg-opacity-90 transition"
          >
            Se connecter avec Keycloak
          </button>
          <div className="mt-4 text-xs text-gray-400">
            Vous serez redirigé vers la page de connexion sécurisée
          </div>
        </div>
      </div>
    );
  }

  // Si authentifié, on peut afficher l'application
  const userUuid = keycloak.tokenParsed?.sub;
  const roles = keycloak.realmAccess?.roles || [];

  const isPatient = roles.includes('patient');
  const isSecretary = roles.includes('secretary');
  const isAdmin = roles.includes('admin');

  const handleBookingSuccess = () => {
    setReloadTrigger(prev => prev + 1);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F5F7FA] font-['Poppins']">
        
        {/* Barre de navigation */}
        <nav className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0D1B3D] rounded-xl flex items-center justify-center text-white font-black text-xl">
              M
            </div>
            <span className="text-2xl font-black text-[#0D1B3D] tracking-tight">
              Medi<span className="text-[#2EAF5E]">go</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400 font-medium">Connecté en tant que</p>
              <p className="text-sm font-bold text-[#0D1B3D]">
                {keycloak.tokenParsed?.given_name || keycloak.tokenParsed?.preferred_username || 'Utilisateur'} 
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 uppercase">
                  {isAdmin ? 'Admin' : isSecretary ? 'Secrétaire' : isPatient ? 'Patient' : 'Inconnu'}
                </span>
              </p>
            </div>

            <button
              onClick={() => {
                console.log("👋 Déconnexion...");
                logout();
              }}
              className="bg-red-50 text-red-600 hover:bg-red-100 px-3.5 py-2 rounded-lg text-xs font-semibold transition border border-red-100"
            >
              Déconnexion
            </button>
          </div>
        </nav>

        {/* Contenu principal filtré selon le rôle */}
        <main className="p-6 max-w-7xl mx-auto">
          {/* VUE PATIENT */}
          {isPatient && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                <div className="text-center py-2">
                  <h1 className="text-2xl font-bold text-[#0D1B3D]">Prendre rendez-vous</h1>
                  <p className="text-gray-500 mt-1 text-sm">Vos soins, partout, à portée de main</p>
                </div>
                <PatientBooking onBookingSuccess={handleBookingSuccess} />
                <PatientProfile keycloakUuid={userUuid} />
              </div>

              <div className="lg:col-span-2 space-y-6">
                <PatientAppointmentsList 
                  key={reloadTrigger} 
                  keycloakUuid={userUuid} 
                />
              </div>
            </div>
          )}

          {/* VUE SECRÉTAIRE */}
          {isSecretary && (
            <SecretaryDashboard key={reloadTrigger} />
          )}

          {/* VUE ADMIN */}
          {isAdmin && (
            <AdminDashboard key={reloadTrigger} />
          )}

          {/* AUCUN RÔLE VALIDE */}
          {!isPatient && !isSecretary && !isAdmin && (
            <div className="bg-white p-8 rounded-2xl shadow-sm text-center border border-gray-100 max-w-lg mx-auto mt-12">
              <h2 className="text-xl font-bold text-[#0D1B3D] mb-2">Rôle non attribué</h2>
              <p className="text-sm text-gray-500">
                Votre compte ne possède aucun rôle valide (Patient, Secrétaire ou Administrateur). Veuillez contacter le support.
              </p>
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}