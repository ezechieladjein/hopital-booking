import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState("Vérification du paiement en cours...");
  const [isError, setIsError] = useState(false);
  const [transactionId, setTransactionId] = useState(null);
  const [appointmentId, setAppointmentId] = useState(null);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const apptId = searchParams.get("appointment_id");
    const txId = searchParams.get("id");

    if (!apptId || !txId) {
      setStatusMessage("Informations de paiement manquantes.");
      setIsError(true);
      return;
    }

    setAppointmentId(apptId);
    setTransactionId(txId);

    // 🔄 POLLING : On interroge périodiquement le statut du paiement
    // Le webhook met à jour la BDD, on attend que ce soit fait
    let attempts = 0;
    const maxAttempts = 20; // 20 * 3s = 60 secondes max
    const interval = 3000; // 3 secondes

    const checkPaymentStatus = async () => {
      attempts++;
      
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/appointments/${apptId}/payment-status`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          }
        );
        const data = await res.json();

        if (data.success) {
          // ✅ Le paiement a été confirmé par le webhook
          setStatusMessage("Paiement validé avec succès ! Redirection...");
          setTimeout(() => {
            navigate("/patient/appointments");
          }, 2000);
          clearInterval(intervalId);
          return;
        } else if (data.status === 'declined') {
          // ❌ Le paiement a échoué
          setStatusMessage("Le paiement a échoué. Veuillez réessayer.");
          setIsError(true);
          clearInterval(intervalId);
          return;
        }

        // Si on a atteint le nombre max d'essais, on arrête
        if (attempts >= maxAttempts) {
          setStatusMessage("Le paiement est en cours de traitement. Revenez dans quelques minutes ou consultez vos rendez-vous.");
          setIsError(true);
          clearInterval(intervalId);
        }

      } catch (err) {
        // Erreur réseau, on continue de réessayer
        console.error("Polling error:", err);
        if (attempts >= maxAttempts) {
          setStatusMessage("Impossible de vérifier le statut du paiement. Veuillez consulter vos rendez-vous.");
          setIsError(true);
          clearInterval(intervalId);
        }
      }
    };

    // Démarrer le polling
    const intervalId = setInterval(checkPaymentStatus, interval);
    // Premier appel immédiat
    checkPaymentStatus();

    return () => clearInterval(intervalId);

  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-['Poppins'] p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full text-center">
        {!isError ? (
          <div className="space-y-4">
            <div className="w-12 h-12 border-4 border-[#0D1B3D] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="text-lg font-bold text-[#0D1B3D]">Confirmation en cours</h2>
            <p className="text-sm text-gray-600">{statusMessage}</p>
            <p className="text-xs text-gray-400">
              Transaction #{transactionId}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              ✕
            </div>
            <h2 className="text-lg font-bold text-red-600">Paiement en attente</h2>
            <p className="text-sm text-gray-600">{statusMessage}</p>
            <button
              onClick={() => navigate("/patient/appointments")}
              className="mt-4 bg-[#0D1B3D] text-white text-xs font-bold px-5 py-2.5 rounded-xl"
            >
              Voir mes rendez-vous
            </button>
          </div>
        )}
      </div>
    </div>
  );
}