// src/PaymentCallback.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiFetch } from "./api";
import { useTheme } from './context/ThemeContext';

export default function PaymentCallback() {
  const { darkMode } = useTheme();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [statusMessage, setStatusMessage] = useState("Vérification du paiement en cours...");
  const [isError, setIsError] = useState(false);
  const [appointmentDetails, setAppointmentDetails] = useState(null);

  useEffect(() => {
    const apptId = searchParams.get("appointment_id");
    const txId = searchParams.get("id");

    if (!apptId || !txId) {
      setStatusMessage("Informations de paiement manquantes.");
      setIsError(true);
      return;
    }

    const verifyPayment = async () => {
      try {
        const verifyRes = await apiFetch("/payments/verify", {
          method: "POST",
          body: JSON.stringify({ appointment_id: apptId, id: txId }),
        });

        if (verifyRes.success) {
          setStatusMessage("Paiement validé avec succès !");
          setAppointmentDetails(verifyRes.appointment || verifyRes.data);
        } else {
          setStatusMessage(verifyRes.message || "Paiement non confirmé.");
          setIsError(true);
        }
      } catch (err) {
        setStatusMessage("Erreur réseau lors de la validation.");
        setIsError(true);
      }
    };

    verifyPayment();
  }, [searchParams]);

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 font-['Poppins'] ${
      darkMode ? 'bg-[#0B0F17]' : 'bg-gray-50'
    }`}>
      <div className={`p-8 rounded-2xl shadow-sm border max-w-xl w-full text-center space-y-6 ${
        darkMode 
          ? 'bg-[#1E293B] border-gray-700' 
          : 'bg-white border-gray-100'
      }`}>
        {!isError ? (
          appointmentDetails ? (
            <div className="space-y-6 text-left">
              <div id="receipt-pdf" className={`p-6 border rounded-2xl space-y-4 ${
                darkMode ? 'bg-[#111827] border-gray-700' : 'bg-white'
              }`}>
                <div className={`flex justify-between border-b pb-3 ${darkMode ? 'border-gray-700' : ''}`}>
                  <div>
                    <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>MEDIGO ATTESTATION</h2>
                    <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Reçu de Confirmation de Rendez-Vous</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full h-fit border border-emerald-200">
                    PAYÉ (CONFIRMÉ)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Patient</p>
                    <p className={`font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                      {appointmentDetails.patient?.nom} {appointmentDetails.patient?.prenom}
                    </p>
                  </div>
                  <div>
                    <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Médecin & Spécialité</p>
                    <p className={`font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Dr. {appointmentDetails.slot?.doctor?.nom}</p>
                    <p className={`text-[10px] ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>{appointmentDetails.slot?.doctor?.speciality?.nom}</p>
                  </div>
                </div>

                <div className={`p-3 rounded-xl grid grid-cols-2 gap-2 text-xs border ${
                  darkMode ? 'bg-[#111827] border-gray-700' : 'bg-gray-50'
                }`}>
                  <div>
                    <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Date Consultation</p>
                    <p className={`font-bold ${darkMode ? 'text-white' : ''}`}>{appointmentDetails.slot?.date_consultation}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Heure du RDV</p>
                    <p className={`font-bold ${darkMode ? 'text-white' : ''}`}>{appointmentDetails.slot?.start_time?.substring(0, 5)}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex-1 bg-[#0D1B3D] text-white text-xs font-bold py-2.5 rounded-xl shadow-sm"
                >
                  Télécharger le Reçu PDF
                </button>
                <button
                  onClick={() => navigate("/patient/appointments")}
                  className={`flex-1 text-xs font-bold py-2.5 rounded-xl ${
                    darkMode 
                      ? 'bg-[#111827] text-gray-300' 
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Voir mes rendez-vous
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-8">
              <div className="w-10 h-10 border-4 border-[#0D1B3D] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className={`text-xs font-bold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{statusMessage}</p>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-red-600">Problème de Paiement</h2>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{statusMessage}</p>
            <button
              onClick={() => navigate("/patient/appointments")}
              className="bg-[#0D1B3D] text-white text-xs font-bold px-5 py-2.5 rounded-xl"
            >
              Retour
            </button>
          </div>
        )}
      </div>
    </div>
  );
}