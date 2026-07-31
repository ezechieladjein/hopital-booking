import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiFetch } from './api';

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [statusMessage, setStatusMessage] = useState("Vérification du paiement en cours...");
  const [isError, setIsError] = useState(false);
  const [transactionId, setTransactionId] = useState(null);
  const [appointmentId, setAppointmentId] = useState(null);

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

    let isMounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 12; // On attend max 60 secondes (12 * 5s)

    const verifyPaymentLoop = async () => {
      if (retryCount >= MAX_RETRIES) {
        if (isMounted) {
          setStatusMessage("Le serveur met trop de temps à confirmer. Vérifiez vos rendez-vous.");
          setIsError(true);
        }
        return;
      }

      try {
        // On demande à Laravel s'il a bien reçu le webhook et traité le paiement
        const verifyRes = await apiFetch("/payments/verify", {
          method: "POST",
          body: JSON.stringify({
            appointment_id: apptId,
            id: txId,
          }),
        });

        if (verifyRes.success) {
          // Succès ! On redirige l'utilisateur vers son dashboard
          if (isMounted) {
            setStatusMessage("Paiement validé avec succès !");
            setTimeout(() => navigate("/patient/appointments"), 1500);
          }
          return;
        } else {
          // Si c'est un échec définitif (ex: declined), on arrête et on affiche l'erreur
          if (verifyRes.message?.includes('declined') || verifyRes.message?.includes('échoué')) {
            if (isMounted) {
              setStatusMessage(verifyRes.message);
              setIsError(true);
            }
            return;
          }
          
          // Si c'est juste "en attente", on relance la vérification après 5 secondes
          retryCount++;
          setTimeout(verifyPaymentLoop, 5000);
        }
      } catch (err) {
        console.error("Erreur lors de la vérification :", err);
        // En cas d'erreur réseau, on réessaie aussi
        retryCount++;
        setTimeout(verifyPaymentLoop, 5000);
      }
    };

    verifyPaymentLoop();

    return () => {
      isMounted = false; // Cleanup pour éviter les fuites mémoire si l'utilisateur quitte la page
    };
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
            <h2 className="text-lg font-bold text-red-600">Paiement non confirmé</h2>
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