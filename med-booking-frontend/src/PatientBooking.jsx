import React, { useState, useEffect } from "react";

export default function PatientBooking({ onBookingSuccess }) {
  const [catalog, setCatalog] = useState([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);

  // States pour la gestion de l'assurance
  const [hasInsurance, setHasInsurance] = useState(false);
  const [insuranceName, setInsuranceName] = useState("");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("");
  const [insuranceFile, setInsuranceFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Charger les spécialités et médecins (le catalogue) depuis l'API
  // Charger les spécialités et médecins (le catalogue) depuis l'API
  useEffect(() => {
    fetch("http://localhost:8000/api/catalog")
      .then((res) => res.json())
      .then((resData) => {
        // 🚀 On extrait le tableau depuis "resData.data" car ton API renvoie { success: true, data: [...] }
        if (resData && Array.isArray(resData.data)) {
          setCatalog(resData.data);
        } else if (Array.isArray(resData)) {
          setCatalog(resData);
        } else {
          setCatalog([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erreur lors du chargement du catalogue:", err);
        setCatalog([]);
        setLoading(false);
      });
  }, []);

  // Filtrer les données en fonction des sélections
  const currentSpecialty = catalog.find(
    (spec) => String(spec.id) === String(selectedSpecialty),
  );
  const activeDoctors = currentSpecialty ? currentSpecialty.doctors : [];
  const currentDoctor = activeDoctors.find(
    (doc) => String(doc.id) === String(selectedDoctor),
  );

  // Regrouper les créneaux disponibles du médecin par date
  // Récupérer la date et l'heure actuelles
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0]; // "YYYY-MM-DD"

  // Format HH:MM actuel pour la comparaison
  const currentHours = String(now.getHours()).padStart(2, "0");
  const currentMinutes = String(now.getMinutes()).padStart(2, "0");
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  const slotsByDate = {};

  if (currentDoctor && currentDoctor.slots) {
    currentDoctor.slots
      .filter((slot) => {
        // 1. Vérifier si le statut du créneau est 'Disponible'
        if (slot.status !== "Disponible") return false;

        // 2. Ignorer les dates antérieures à aujourd'hui
        if (slot.date_consultation < todayStr) return false;

        // 3. Si c'est aujourd'hui, vérifier que l'heure du créneau n'est pas passée
        if (slot.date_consultation === todayStr) {
          const slotStartTime = slot.start_time.substring(0, 5); // Ex: "14:30"
          if (slotStartTime <= currentTimeStr) return false;
        }

        return true;
      })
      .forEach((slot) => {
        if (!slotsByDate[slot.date_consultation]) {
          slotsByDate[slot.date_consultation] = [];
        }
        slotsByDate[slot.date_consultation].push(slot);
      });
  }
  const availableDates = Object.keys(slotsByDate).sort();

  const handleConfirmBooking = async () => {
    if (!selectedSlot) return;
    setBookingLoading(true);

    // Utilisation de FormData pour envoyer les données textuelles et le fichier physique
    const formData = new FormData();
    formData.append("slot_id", selectedSlot.id);
    formData.append("keycloak_uuid", "sub-test-keycloak-12345"); // Simulé pour le dev local
    formData.append("nom", "Houessou");
    formData.append("prenom", "Jean");
    formData.append("email", "jean.houessou@example.com");
    formData.append("has_insurance", hasInsurance);

    if (hasInsurance) {
      formData.append("insurance_name", insuranceName);
      formData.append("insurance_policy_number", insurancePolicyNumber);
      if (insuranceFile) {
        formData.append("insurance_document", insuranceFile);
      }
    }

    try {
      const response = await fetch("http://localhost:8000/api/appointments", {
        method: "POST",
        body: formData, // Pas de headers de Content-Type, le navigateur s'en charge
      });

      const data = await response.json();
      if (data.success) {
        alert("Votre réservation a été enregistrée avec succès !");
        // Réinitialisation du formulaire
        setSelectedSlot(null);
        setSelectedDate("");
        setHasInsurance(false);
        setInsuranceName("");
        setInsurancePolicyNumber("");
        setInsuranceFile(null);
        onBookingSuccess(); // Rafraîchit l'historique côté patient et secrétaire
      } else {
        alert(`Erreur : ${data.message}`);
      }
    } catch (error) {
      console.error("Erreur lors de la réservation:", error);
      alert("Impossible de finaliser la réservation.");
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading)
    return (
      <div className="text-center py-4 text-gray-500">
        Chargement du catalogue de soins...
      </div>
    );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 font-['Poppins']">
      {/* Étape 1 : Choisir la Spécialité */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Spécialité médicale
        </label>
        <select
          value={selectedSpecialty}
          onChange={(e) => {
            setSelectedSpecialty(e.target.value);
            setSelectedDoctor("");
            setSelectedDate("");
            setSelectedSlot(null);
          }}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 focus:ring-2 focus:ring-[#1565C0] focus:outline-none"
        >
          <option value="">-- Choisissez une spécialité --</option>
          {catalog.map((spec) => (
            <option key={spec.id} value={spec.id}>
              {spec.nom}
            </option>
          ))}
        </select>
      </div>

      {/* Étape 2 : Choisir le Médecin */}
      {selectedSpecialty && (
        <div className="mb-4 animate-fadeIn">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Médecin disponible
          </label>
          <select
            value={selectedDoctor}
            onChange={(e) => {
              setSelectedDoctor(e.target.value);
              setSelectedDate("");
              setSelectedSlot(null);
            }}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 focus:ring-2 focus:ring-[#1565C0] focus:outline-none"
          >
            <option value="">-- Choisissez un médecin --</option>
            {activeDoctors.map((doc) => (
              <option key={doc.id} value={doc.id}>
                Dr. {doc.nom} {doc.prenom}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Étape 3 : Choisir la Date */}
      {selectedDoctor && (
        <div className="mb-4 animate-fadeIn">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Date de consultation
          </label>
          <select
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSelectedSlot(null);
            }}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 focus:ring-2 focus:ring-[#1565C0] focus:outline-none"
          >
            <option value="">-- Choisissez une date --</option>
            {availableDates.map((date) => {
              const formattedDate = new Date(date).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              return (
                <option key={date} value={date}>
                  {formattedDate}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Étape 4 : Choisir le Créneau */}
      {selectedDate && (
        <div className="mb-6 animate-fadeIn">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Horaires disponibles
          </label>
          <div className="grid grid-cols-3 gap-2">
            {slotsByDate[selectedDate]?.map((slot) => (
              <button
                key={slot.id}
                onClick={() => setSelectedSlot(slot)}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                  selectedSlot?.id === slot.id
                    ? "bg-[#1565C0] text-white border-[#1565C0]"
                    : "bg-white text-gray-700 border-gray-200 hover:border-[#1565C0]"
                }`}
              >
                {slot.start_time.substring(0, 5)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Étape 5 : Section Assurance */}
      {selectedSlot && (
        <div className="mb-6 p-4 bg-blue-50/50 rounded-xl border border-blue-100 animate-fadeIn">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasInsurance}
              onChange={(e) => setHasInsurance(e.target.checked)}
              className="w-4 h-4 text-[#1565C0] border-gray-300 rounded focus:ring-[#1565C0]"
            />
            <span className="text-sm font-semibold text-[#0D1B3D]">
              J'ai une assurance maladie
            </span>
          </label>

          {hasInsurance && (
            <div className="mt-4 space-y-3 animate-fadeIn">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Nom de l'assurance
                </label>
                <input
                  type="text"
                  placeholder="Ex: NSIA, Sunu, Saham..."
                  value={insuranceName}
                  onChange={(e) => setInsuranceName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1565C0]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Numéro de police / carte d'assurance
                </label>
                <input
                  type="text"
                  placeholder="N° de contrat"
                  value={insurancePolicyNumber}
                  onChange={(e) => setInsurancePolicyNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1565C0]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Justificatif (PDF, PNG, JPG)
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setInsuranceFile(e.target.files[0])}
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 border border-gray-200 rounded-lg p-1 bg-white cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Étape 6 : Bouton de confirmation */}
      {selectedSlot && (
        <button
          onClick={handleConfirmBooking}
          disabled={bookingLoading}
          className="w-full bg-[#0D1B3D] hover:bg-[#1a2f60] text-white font-bold py-3 px-4 rounded-xl transition text-sm flex justify-center items-center gap-2"
        >
          {bookingLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Réservation en cours...
            </>
          ) : (
            "Confirmer mon rendez-vous"
          )}
        </button>
      )}
    </div>
  );
}
