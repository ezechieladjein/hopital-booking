import React, { useState, useEffect } from "react";

export default function PatientAppointmentsList() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);

  const fetchAppointments = () => {
    fetch("http://localhost:8000/api/secretary/appointments")
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success) {
          const myAppts = resData.data.filter(
            (appt) => appt.patient?.email === "jean.houessou@example.com"
          );
          setAppointments(myAppts);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erreur de récupération des rendez-vous:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAppointments();

    // Recharger la liste si le patient revient sur cet onglet après paiement
    const handleFocus = () => fetchAppointments();
    window.addEventListener("focus", handleFocus);

    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const handlePay = async (appointmentId) => {
    setPayingId(appointmentId);
    try {
      const response = await fetch(
        "http://localhost:8000/api/payments/initiate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ appointment_id: appointmentId }),
        }
      );

      const data = await response.json();

      if (data.success && data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        alert(`Erreur d'initialisation du paiement : ${data.message}`);
        setPayingId(null);
      }
    } catch (error) {
      alert("Impossible de joindre le serveur de paiement.");
      setPayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4 text-gray-500">
        Chargement de vos rendez-vous...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 font-['Poppins']">
      <h3 className="text-xl font-bold text-[#0D1B3D] mb-6 pb-3 border-b border-gray-50">
        Mes Consultations & Paiements
      </h3>

      {appointments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Vous n'avez pas encore programmé de consultation.
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => {
            const slotDate = new Date(appt.slot?.date_consultation);
            const formattedSlotDate = slotDate.toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            });

            const createdDate = new Date(appt.created_at);
            const formattedCreatedDate = createdDate.toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            const formattedCreatedTime = createdDate.toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            });

            const isInsuranceRejected =
              appt.has_insurance &&
              appt.insurance_coverage_rate === 0 &&
              appt.cancellation_reason;

            return (
              <div
                key={appt.id}
                className="p-5 border border-gray-100 rounded-xl hover:border-gray-200 transition space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                        Demande faite le {formattedCreatedDate} à {formattedCreatedTime}
                      </span>
                      <span className="text-sm font-medium text-gray-600">
                        Dr. {appt.slot?.doctor?.nom} {appt.slot?.doctor?.prenom}
                      </span>
                    </div>

                    <h4 className="font-bold text-[#0D1B3D] text-lg capitalize">
                      {formattedSlotDate} à {appt.slot?.start_time?.substring(0, 5)}
                    </h4>

                    <div className="text-xs text-gray-500 mt-1">
                      <span>
                        Tarif de base : {parseInt(appt.base_price).toLocaleString()} FCFA
                      </span>
                      {appt.insurance_coverage_rate > 0 && (
                        <span className="ml-3 font-semibold text-emerald-600">
                          Prise en charge ({appt.insurance_coverage_rate}%)
                        </span>
                      )}
                      <span className="ml-3 font-bold text-[#1565C0]">
                        Reste à payer : {parseInt(appt.amount_to_pay).toLocaleString()} FCFA
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        appt.status === "CONFIRME" || appt.status === "TERMINE"
                          ? "bg-emerald-50 text-emerald-700"
                          : appt.status === "EN_ATTENTE_VALIDATION"
                          ? "bg-blue-50 text-blue-700"
                          : appt.status === "EN_ATTENTE_PAIEMENT"
                          ? "bg-amber-50 text-amber-700 animate-pulse"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {appt.status === "EN_ATTENTE_VALIDATION"
                        ? "En attente de validation"
                        : appt.status === "EN_ATTENTE_PAIEMENT"
                        ? "Prêt pour paiement"
                        : appt.status}
                    </span>

                    {appt.status === "EN_ATTENTE_PAIEMENT" && (
                      <button
                        onClick={() => handlePay(appt.id)}
                        disabled={payingId === appt.id}
                        className="bg-[#0D1B3D] hover:bg-opacity-90 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
                      >
                        {payingId === appt.id
                          ? "Redirection..."
                          : `Payer ${parseInt(appt.amount_to_pay).toLocaleString()} XOF`}
                      </button>
                    )}
                  </div>
                </div>

                {isInsuranceRejected && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-800">
                    <p className="font-bold mb-0.5">
                      ⚠️ Prise en charge assurance refusée (Taux : 0%)
                    </p>
                    <p>
                      Motif : <span className="italic">{appt.cancellation_reason}</span>. Votre demande reste valide et votre paiement est toujours en attente, mais le montant total (100%) est à votre charge.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}