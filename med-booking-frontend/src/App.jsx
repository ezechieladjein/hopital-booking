// src/App.jsx
import React, { useState, useEffect } from 'react';
import keycloak, { initKeycloak, login, logout } from './keycloak-init';
import HomePage from './HomePage';
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
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [primaryRole, setPrimaryRole] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      try {
        const auth = await initKeycloak();
        setAuthenticated(auth);

        if (auth) {
          const roles = getRoles();
          determinePrimaryRole(roles);
        }
      } catch (err) {
        console.error("❌ Erreur authentification:", err);
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const getRoles = () => {
    try {
      const realmRoles = keycloak.realmAccess?.roles || [];
      const clientRoles = keycloak.resourceAccess?.['med-booking-front']?.roles || [];
      const tokenRealmRoles = keycloak.tokenParsed?.realm_access?.roles || [];
      const tokenClientRoles = keycloak.tokenParsed?.resource_access?.['med-booking-front']?.roles || [];
      const combined = [...realmRoles, ...clientRoles, ...tokenRealmRoles, ...tokenClientRoles];
      return [...new Set(combined.filter(role => role && role.trim() !== ''))];
    } catch (error) {
      console.error("❌ Erreur de récupération des rôles:", error);
      return [];
    }
  };

  const determinePrimaryRole = (roles) => {
    const hasAdmin = roles.some(r => r.toLowerCase() === 'admin');
    const hasSecretary = roles.some(r => r.toLowerCase() === 'secretary');
    const hasPatient = roles.some(r => r.toLowerCase() === 'patient');

    if (hasAdmin) setPrimaryRole('admin');
    else if (hasSecretary) setPrimaryRole('secretary');
    else if (hasPatient) setPrimaryRole('patient');
    else setPrimaryRole(null);
  };

  if (window.location.pathname.startsWith('/payment-callback')) {
    return <PaymentCallback />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#0D1B3D] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium font-['Poppins']">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <HomePage />;
  }

  if (!primaryRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-yellow-200 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-yellow-600 mb-2">Aucun rôle valide</h2>
          <p className="text-sm text-gray-600 mb-4">
            Votre compte ne possède aucun rôle valide (patient, secretary, admin).
          </p>
          <button
            onClick={() => logout()}
            className="w-full bg-red-50 text-red-600 py-2.5 rounded-xl font-bold text-sm hover:bg-red-100 transition border border-red-200"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  const userUuid = keycloak.tokenParsed?.sub;

  const handleBookingSuccess = () => {
    setReloadTrigger(prev => prev + 1);
  };

  const renderContent = () => {
    switch (primaryRole) {
      case 'admin':
        return <AdminDashboard key={reloadTrigger} />;

      case 'secretary':
        return <SecretaryDashboard key={reloadTrigger} />;

      case 'patient':
        return (
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
        );

      default:
        return null;
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F5F7FA] font-['Poppins']">
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
                  {primaryRole === 'admin' ? 'Admin' : primaryRole === 'secretary' ? 'Secrétaire' : 'Patient'}
                </span>
              </p>
            </div>

            <button
              onClick={() => logout()}
              className="bg-red-50 text-red-600 hover:bg-red-100 px-3.5 py-2 rounded-lg text-xs font-semibold transition border border-red-100 cursor-pointer"
            >
              Déconnexion
            </button>
          </div>
        </nav>

        <main className="p-6 max-w-7xl mx-auto">
          {renderContent()}
        </main>
      </div>
    </ErrorBoundary>
  );
}