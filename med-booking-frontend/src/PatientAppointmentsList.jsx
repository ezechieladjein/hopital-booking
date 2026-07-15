import React, { useState, useEffect } from "react";

export default function PatientAppointmentsList() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);

  // Charger les rendez-vous du patient de test
  const fetchAppointments = () => {
    // Note : En production, on filtrera par l'ID du patient connecté via Keycloak.
    // Pour l'instant, on récupère tout pour le dev local.
    fetch("http://localhost:8000/api/secretary/appointments")
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success) {
          // On filtre pour ne garder que les RDV du patient de test
          const myAppts = resData.data.filter(
            (appt) => appt.patient?.email === "jean.houessou@example.com",
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
  }, []);

  // Déclencher le paiement FedaPay
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
        },
      );

      const data = await response.json();

      if (data.success && data.payment_url) {
        // Rediriger le patient vers le guichet de paiement sécurisé de FedaPay
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

  if (loading)
    return (
      <div className="text-center py-4 text-gray-500">
        Chargement de vos rendez-vous...
      </div>
    );

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
            const dateObj = new Date(appt.slot?.date_consultation);
            const formattedDate = dateObj.toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            });

            return (
              <div
                key={appt.id}
                className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-[#2EAF5E] bg-green-50 px-2 py-0.5 rounded-full">
                      RDV #{appt.id}
                    </span>
                    <span className="text-sm text-gray-400">
                      Médecin : Dr. {appt.slot?.doctor?.nom}{" "}
                      {appt.slot?.doctor?.prenom}
                    </span>
                  </div>
                  <h4 className="font-bold text-[#0D1B3D] capitalize">
                    {formattedDate} à {appt.slot?.start_time.substring(0, 5)}
                  </h4>
                  <div className="text-xs text-gray-500 mt-1">
                    <span>
                      Tarif de base :{" "}
                      {parseInt(appt.base_price).toLocaleString()} FCFA
                    </span>
                    {appt.amount_to_pay !== appt.base_price && (
                      <span className="ml-3 font-semibold text-blue-600">
                        Reste à charge :{" "}
                        {parseInt(appt.amount_to_pay).toLocaleString()} FCFA
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Badge de statut */}
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

                  {/* Bouton de paiement dynamique */}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
