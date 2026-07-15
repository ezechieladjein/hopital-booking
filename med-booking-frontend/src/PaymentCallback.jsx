import React, { useEffect, useState } from 'react';

export default function PaymentCallback() {
  const [status, setStatus] = useState('processing'); // processing | success | error

  useEffect(() => {
    // 1. Récupérer les paramètres renvoyés par FedaPay dans l'URL
    const params = new URLSearchParams(window.location.search);
    const appointmentId = params.get('appointment_id');
    const transactionStatus = params.get('status'); // FedaPay renvoie 'approved' si payé

    if (appointmentId && transactionStatus) {
      // 2. Notifier notre backend Laravel pour mettre à jour la base de données
      fetch('http://localhost:8000/api/payments/callback-handler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          appointment_id: appointmentId,
          status: transactionStatus
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setStatus('success');
          } else {
            setStatus('error');
          }
        })
        .catch(() => setStatus('error'));
    } else {
      setStatus('error');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6 font-['Poppins']">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        
        {status === 'processing' && (
          <div>
            <div className="w-12 h-12 border-4 border-[#1565C0] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-bold text-[#0D1B3D]">Validation de votre paiement...</h3>
            <p className="text-sm text-gray-500 mt-1">Veuillez ne pas fermer cette page.</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              ✓
            </div>
            <h3 className="text-xl font-bold text-[#0D1B3D]">Paiement Réussi !</h3>
            <p className="text-sm text-gray-500 mt-2">
              Votre consultation est maintenant validée et réglée. Vous pouvez retourner à votre espace personnel.
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="mt-6 bg-[#0D1B3D] text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-opacity-90 transition"
            >
              Retour à l'accueil
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              ✗
            </div>
            <h3 className="text-xl font-bold text-red-700">Échec du paiement</h3>
            <p className="text-sm text-gray-500 mt-2">
              Une erreur s'est produite ou la transaction a été annulée. Aucun montant n'a été débité.
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="mt-6 bg-[#0D1B3D] text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-opacity-90 transition"
            >
              Réessayer
            </button>
          </div>
        )}

      </div>
    </div>
  );
}