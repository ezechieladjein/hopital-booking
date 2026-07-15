import React, { useState } from 'react';
import PatientBooking from './PatientBooking';
import SecretaryDashboard from './SecretaryDashboard';
import PatientAppointmentsList from './PatientAppointmentsList';
import PaymentCallback from './PaymentCallback';

// 🛡️ Filet de sécurité anti-page blanche
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
            className="bg-[#0D1B3D] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-opacity-90 transition"
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
  const [activeRole, setActiveRole] = useState('patient');
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Routage de secours pour la redirection FedaPay
  if (window.location.pathname === '/payment-callback') {
    return <PaymentCallback />;
  }

  const handleBookingSuccess = () => {
    setReloadTrigger(prev => prev + 1);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F5F7FA] font-['Poppins']">
        
        {/* Navbar Medigo */}
        <nav className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0D1B3D] rounded-xl flex items-center justify-center text-white font-black text-xl">
              M
            </div>
            <span className="text-2xl font-black text-[#0D1B3D] tracking-tight">
              Medi<span className="text-[#2EAF5E]">go</span>
            </span>
          </div>

          {/* Commutateur de rôles (Dev local) */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => setActiveRole('patient')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                activeRole === 'patient' 
                  ? 'bg-white text-[#0D1B3D] shadow-sm' 
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Vue Patient
            </button>
            <button
              onClick={() => setActiveRole('secretary')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                activeRole === 'secretary' 
                  ? 'bg-white text-[#0D1B3D] shadow-sm' 
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Vue Secrétaire
            </button>
          </div>
        </nav>

        {/* Contenu principal */}
        <main className="p-6 max-w-7xl mx-auto">
          {activeRole === 'patient' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Formulaire de réservation à gauche */}
              <div className="lg:col-span-1 space-y-6">
                <div className="text-center py-2">
                  <h1 className="text-2xl font-bold text-[#0D1B3D]">Prendre rendez-vous</h1>
                  <p className="text-gray-500 mt-1 text-sm">Vos soins, partout, à portée de main</p>
                </div>
                <PatientBooking onBookingSuccess={handleBookingSuccess} />
              </div>

              {/* Historique des rendez-vous et paiement à droite */}
              <div className="lg:col-span-2 space-y-6">
                <PatientAppointmentsList key={reloadTrigger} />
              </div>

            </div>
          ) : (
            <SecretaryDashboard key={reloadTrigger} />
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}