import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import keycloak, { initKeycloak, login, logout } from './keycloak-init';
import Navbar from './components/Navbar';
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
  const [isRefreshing, setIsRefreshing] = useState(false);
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
        console.error("Erreur authentification:", err);
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
    const lowerRoles = roles.map(r => r.toLowerCase());

    const hasAdmin = lowerRoles.includes('admin');
    const hasSecretary = lowerRoles.includes('secretary') || lowerRoles.includes('secretaire');
    const hasPatient = lowerRoles.includes('patient');

    if (hasAdmin) setPrimaryRole('admin');
    else if (hasSecretary) setPrimaryRole('secretary');
    else if (hasPatient) setPrimaryRole('patient');
    else setPrimaryRole(null);
  };

  // Mécanisme global de rafraîchissement des données sans recharger la page
  const handleGlobalRefresh = () => {
    setIsRefreshing(true);
    setReloadTrigger(prev => prev + 1);

    // Petit effet visuel de rotation de l'icône pendant 500ms
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
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
    return <LoginRedirect />;
  }

  if (!primaryRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-yellow-200 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-yellow-600 mb-2">Aucun rôle valide</h2>
          <p className="text-sm text-gray-600 mb-4">
            Votre compte ne possède aucun rôle valide (Patient, Secrétaire, Administrateur).
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

  const LoginRedirect = () => {
    useEffect(() => {
      login();
    }, []);
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#0D1B3D] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium font-['Poppins']">Redirection vers l'authentification...</p>
        </div>
      </div>
    );
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
              <PatientBooking onBookingSuccess={handleGlobalRefresh} />
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
        <Navbar
          keycloak={keycloak}
          primaryRole={primaryRole}
          onRefresh={handleGlobalRefresh}
          isRefreshing={isRefreshing}
          onLogout={() => logout()}
        />

        <main className="p-6 max-w-7xl mx-auto">
          {renderContent()}
        </main>
      </div>
    </ErrorBoundary>
  );
}