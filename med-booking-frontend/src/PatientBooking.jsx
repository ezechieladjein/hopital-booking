// src/PatientBooking.jsx
import React, { useState, useEffect } from "react";
import { apiFetch } from './api';
import keycloak from './keycloak-init';
import { useTheme } from './context/ThemeContext';

export default function PatientBooking({ onBookingSuccess }) {
  const { darkMode } = useTheme();
  const [catalog, setCatalog] = useState([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [hasInsurance, setHasInsurance] = useState(false);
  const [savedInsurances, setSavedInsurances] = useState([]);
  const [selectedInsuranceId, setSelectedInsuranceId] = useState("");
  const [isNewInsurance, setIsNewInsurance] = useState(false);

  const [insuranceName, setInsuranceName] = useState("");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("");
  const [insuranceFile, setInsuranceFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch('/catalog'),
      apiFetch('/patient/insurances').catch(() => ({ data: [] }))
    ]).then(([catRes, insRes]) => {
      if (catRes && Array.isArray(catRes.data)) setCatalog(catRes.data);
      else if (Array.isArray(catRes)) setCatalog(catRes);

      if (insRes && Array.isArray(insRes.data)) {
        setSavedInsurances(insRes.data);
        if (insRes.data.length > 0) {
          setSelectedInsuranceId(insRes.data[0].id);
        } else {
          setIsNewInsurance(true);
        }
      }
      setLoading(false);
    }).catch((err) => {
      console.error("Erreur de chargement:", err);
      setLoading(false);
    });
  }, []);

  const currentSpecialty = catalog.find((spec) => String(spec.id) === String(selectedSpecialty));
  const activeDoctors = currentSpecialty ? currentSpecialty.doctors : [];
  const currentDoctor = activeDoctors.find((doc) => String(doc.id) === String(selectedDoctor));

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const slotsByDate = {};
  if (currentDoctor && currentDoctor.slots) {
    currentDoctor.slots
      .filter((slot) => {
        if (slot.status !== "Disponible") return false;
        if (slot.date_consultation < todayStr) return false;
        if (slot.date_consultation === todayStr && slot.start_time.substring(0, 5) <= currentTimeStr) return false;
        return true;
      })
      .forEach((slot) => {
        if (!slotsByDate[slot.date_consultation]) slotsByDate[slot.date_consultation] = [];
        slotsByDate[slot.date_consultation].push(slot);
      });
  }
  const availableDates = Object.keys(slotsByDate).sort();

  const handleConfirmBooking = async () => {
    if (!selectedSlot) return;
    setBookingLoading(true);

    const token = keycloak.tokenParsed || {};
    const formData = new FormData();
    formData.append("slot_id", selectedSlot.id);
    formData.append("keycloak_uuid", keycloak.subject || token.sub);
    formData.append("nom", token.family_name || token.nom || "");
    formData.append("prenom", token.given_name || token.prenom || "");
    formData.append("email", token.email || "");
    formData.append("has_insurance", hasInsurance);

    if (hasInsurance) {
      if (isNewInsurance) {
        formData.append("is_new_insurance", "1");
        formData.append("insurance_name", insuranceName);
        formData.append("insurance_policy_number", insurancePolicyNumber);
        if (insuranceFile) formData.append("insurance_document", insuranceFile);
      } else {
        formData.append("insurance_id", selectedInsuranceId);
      }
    }

    try {
      const data = await apiFetch('/appointments', {
        method: "POST",
        body: formData,
      });

      if (data.success) {
        alert("Votre réservation a été enregistrée avec succès !");
        setSelectedSlot(null);
        setSelectedDate("");
        setHasInsurance(false);
        if (onBookingSuccess) onBookingSuccess();
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

  if (loading) return (
    <div className={`text-center py-4 font-medium ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
      Chargement du catalogue de soins...
    </div>
  );

  return (
    <div className={`rounded-2xl shadow-sm border p-6 font-['Poppins'] ${
      darkMode 
        ? 'bg-slate-800 border-slate-700' 
        : 'bg-white border-gray-100'
    }`}>
      {/* Étape 1 : Spécialité */}
      <div className="mb-4">
        <label className={`block text-sm font-semibold mb-1.5 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
          Spécialité médicale
        </label>
        <select
          value={selectedSpecialty}
          onChange={(e) => { setSelectedSpecialty(e.target.value); setSelectedDoctor(""); setSelectedDate(""); setSelectedSlot(null); }}
          className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
            darkMode 
              ? 'bg-slate-700 border-slate-600 text-slate-100' 
              : 'bg-gray-50 border-gray-200 text-gray-700'
          }`}
        >
          <option value="">-- Choisissez une spécialité --</option>
          {catalog.map((spec) => (
            <option key={spec.id} value={spec.id}>{spec.nom}</option>
          ))}
        </select>
      </div>

      {/* Étape 2 : Médecin */}
      {selectedSpecialty && (
        <div className="mb-4 animate-fadeIn">
          <label className={`block text-sm font-semibold mb-1.5 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
            Médecin disponible
          </label>
          <select
            value={selectedDoctor}
            onChange={(e) => { setSelectedDoctor(e.target.value); setSelectedDate(""); setSelectedSlot(null); }}
            className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
              darkMode 
                ? 'bg-slate-700 border-slate-600 text-slate-100' 
                : 'bg-gray-50 border-gray-200 text-gray-700'
            }`}
          >
            <option value="">-- Choisissez un médecin --</option>
            {activeDoctors.map((doc) => (
              <option key={doc.id} value={doc.id}>Dr. {doc.nom} {doc.prenom}</option>
            ))}
          </select>
        </div>
      )}

      {/* Étape 3 : Date */}
      {selectedDoctor && (
        <div className="mb-4 animate-fadeIn">
          <label className={`block text-sm font-semibold mb-1.5 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
            Date de consultation
          </label>
          <select
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(null); }}
            className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
              darkMode 
                ? 'bg-slate-700 border-slate-600 text-slate-100' 
                : 'bg-gray-50 border-gray-200 text-gray-700'
            }`}
          >
            <option value="">-- Choisissez une date --</option>
            {availableDates.map((date) => (
              <option key={date} value={date}>
                {new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Étape 4 : Créneau */}
      {selectedDate && (
        <div className="mb-6 animate-fadeIn">
          <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
            Horaires disponibles
          </label>
          <div className="grid grid-cols-3 gap-2">
            {slotsByDate[selectedDate]?.map((slot) => (
              <button
                key={slot.id}
                onClick={() => setSelectedSlot(slot)}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                  selectedSlot?.id === slot.id 
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/25" 
                    : darkMode
                      ? "bg-slate-700 text-slate-300 border-slate-600 hover:border-blue-500 hover:bg-slate-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-500 hover:bg-blue-50"
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
        <div className={`mb-6 p-4 rounded-xl border animate-fadeIn ${
          darkMode 
            ? 'bg-blue-900/20 border-blue-800/50' 
            : 'bg-blue-50/50 border-blue-100'
        }`}>
          <label className={`flex items-center gap-3 cursor-pointer ${darkMode ? 'text-slate-200' : 'text-[#0D1B3D]'}`}>
            <input
              type="checkbox"
              checked={hasInsurance}
              onChange={(e) => setHasInsurance(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-semibold">J'ai une assurance maladie</span>
          </label>

          {hasInsurance && (
            <div className="mt-4 space-y-3 animate-fadeIn">
              {savedInsurances.length > 0 && (
                <div className="mb-3">
                  <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                    Choix de l'assurance
                  </label>
                  <div className="flex gap-4 mb-2">
                    <label className={`text-xs flex items-center gap-1 cursor-pointer ${darkMode ? 'text-slate-300' : ''}`}>
                      <input
                        type="radio"
                        name="insuranceChoice"
                        checked={!isNewInsurance}
                        onChange={() => setIsNewInsurance(false)}
                      />
                      Choisir une assurance enregistrée
                    </label>
                    <label className={`text-xs flex items-center gap-1 cursor-pointer ${darkMode ? 'text-slate-300' : ''}`}>
                      <input
                        type="radio"
                        name="insuranceChoice"
                        checked={isNewInsurance}
                        onChange={() => setIsNewInsurance(true)}
                      />
                      Ajouter une nouvelle assurance
                    </label>
                  </div>
                </div>
              )}

              {!isNewInsurance && savedInsurances.length > 0 ? (
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                    Mes assurances enregistrées
                  </label>
                  <select
                    value={selectedInsuranceId}
                    onChange={(e) => setSelectedInsuranceId(e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                      darkMode 
                        ? 'bg-slate-700 border-slate-600 text-slate-100' 
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    {savedInsurances.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.insurance_name} - N° {ins.policy_number}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                      Nom de l'assurance
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: NSIA, Sunu, Saham..."
                      value={insuranceName}
                      onChange={(e) => setInsuranceName(e.target.value)}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                        darkMode 
                          ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500' 
                          : 'bg-white border-gray-200'
                      }`}
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                      Numéro de police / carte
                    </label>
                    <input
                      type="text"
                      placeholder="N° de contrat"
                      value={insurancePolicyNumber}
                      onChange={(e) => setInsurancePolicyNumber(e.target.value)}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${
                        darkMode 
                          ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500' 
                          : 'bg-white border-gray-200'
                      }`}
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                      Justificatif (PDF, PNG, JPG)
                    </label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setInsuranceFile(e.target.files[0])}
                      className={`w-full text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 border rounded-lg p-1 cursor-pointer transition-colors ${
                        darkMode 
                          ? 'bg-slate-700 border-slate-600 text-slate-300 file:bg-blue-900/40 file:text-blue-300 hover:file:bg-blue-900/60' 
                          : 'bg-white border-gray-200'
                      }`}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Étape 6 : Confirmation */}
      {selectedSlot && (
        <button
          onClick={handleConfirmBooking}
          disabled={bookingLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all text-sm flex justify-center items-center gap-2 shadow-sm shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
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