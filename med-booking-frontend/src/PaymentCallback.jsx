import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [statusMessage, setStatusMessage] = useState("Vérification du paiement en cours...");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const appointmentId = searchParams.get("appointment_id");
    const transactionId = searchParams.get("id"); // Envoyé par FedaPay dans l'URL ?id=xxx

    if (!appointmentId || !transactionId) {
      setStatusMessage("Informations de paiement manquantes.");
      setIsError(true);
      return;
    }

    const token = localStorage.getItem("token"); // Récupère le jeton de connexion

    fetch("http://localhost:8000/api/payments/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        appointment_id: appointmentId,
        id: transactionId,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatusMessage("Paiement validé avec succès ! Redirection...");
          setTimeout(() => {
            navigate("/patient/appointments"); // Redirige vers la liste des RDV
          }, 2000);
        } else {
          setIsError(true);
          setStatusMessage(data.message || "Échec de la validation du paiement.");
        }
      })
      .catch((err) => {
        console.error("Erreur de vérification :", err);
        setIsError(true);
        setStatusMessage("Impossible de communiquer avec le serveur.");
      });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-['Poppins'] p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full text-center">
        {!isError ? (
          <div className="space-y-4">
            <div className="w-12 h-12 border-4 border-[#0D1B3D] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="text-lg font-bold text-[#0D1B3D]">Confirmation en cours</h2>
            <p className="text-sm text-gray-600">{statusMessage}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              ✕
            </div>
            <h2 className="text-lg font-bold text-red-600">Erreur de paiement</h2>
            <p className="text-sm text-gray-600">{statusMessage}</p>
            <button
              onClick={() => navigate("/patient/appointments")}
              className="mt-4 bg-[#0D1B3D] text-white text-xs font-bold px-5 py-2.5 rounded-xl"
            >
              Retourner à mes rendez-vous
            </button>
          </div>
        )}
      </div>
    </div>
  );
}