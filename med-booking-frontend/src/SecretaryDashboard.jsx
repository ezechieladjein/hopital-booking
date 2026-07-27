import React, { useState, useEffect, useMemo } from "react";

const API_BASE_URL = "http://localhost:8000/api";
const STORAGE_BASE_URL = "http://localhost:8000/storage";

const DAYS_MAP = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche",
};

export default function SecretaryDashboard() {
  const [activeTab, setActiveTab] = useState("appointments"); // 'appointments' | 'doctors'

  // --- RENDEZ-VOUS ---
  const [appointments, setAppointments] = useState([]);
  const [searchAppt, setSearchAppt] = useState("");
  const [statusFilterAppt, setStatusFilterAppt] = useState("ALL");
  const [insuranceFilterAppt, setInsuranceFilterAppt] = useState("ALL");
  const [dateFilterAppt, setDateFilterAppt] = useState("");

  // --- MÉDECINS & PLANNING ---
  const [doctors, setDoctors] = useState([]);
  const [specialities, setSpecialities] = useState([]);
  const [searchDoctor, setSearchDoctor] = useState("");
  const [specialityFilter, setSpecialityFilter] = useState("ALL");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDateSlots, setSelectedDateSlots] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [doctorSlots, setDoctorSlots] = useState([]);
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);

  // --- HISTORIQUE DES BLOCAGES DU MÉDECIN SÉLECTIONNÉ ---
  const [doctorUnavailabilities, setDoctorUnavailabilities] = useState([]);

  // --- NOUVEAU : EMPLOI DU TEMPS RÉCURRENT & GENERATION ---
  const [weeklyAvailabilities, setWeeklyAvailabilities] = useState([]);
  const [startDateGen, setStartDateGen] = useState("");
  const [endDateGen, setEndDateGen] = useState("");
  const [genMessage, setGenMessage] = useState(null);
  const [showGenSection, setShowGenSection] = useState(false);

  // --- MODALES & CHARGEMENTS ---
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [coverageRate, setCoverageRate] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resAppts, resDocs, resCatalog] = await Promise.all([
        fetch(`${API_BASE_URL}/secretary/appointments`).then((r) => r.json()),
        fetch(`${API_BASE_URL}/secretary/doctors`).then((r) => r.json()),
        fetch(`${API_BASE_URL}/catalog`).then((r) => r.json()),
      ]);

      if (resAppts.success) setAppointments(resAppts.data);
      if (resDocs.success) setDoctors(resDocs.data);
      if (resCatalog.success)
        setSpecialities(resCatalog.data.specialities || resCatalog.data || []);
    } catch (err) {
      console.error("Erreur chargement données:", err);
    } finally {
      setLoading(false);
    }
  };

  // Charger créneaux + historique blocages + récurrence du médecin sélectionné
  const fetchDoctorData = (doctorId, date) => {
    fetch(`${API_BASE_URL}/doctors/${doctorId}/slots?date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setDoctorSlots(data.data || []);
      });

    fetch(`${API_BASE_URL}/secretary/doctors/${doctorId}/unavailabilities`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setDoctorUnavailabilities(data.data || []);
      });

    fetch(`${API_BASE_URL}/secretary/doctors/${doctorId}/availabilities`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setWeeklyAvailabilities(data.data || []);
      });
  };

  useEffect(() => {
    if (selectedDoctor) {
      fetchDoctorData(selectedDoctor.id, selectedDateSlots);
      setSelectedSlotIds([]);
      setGenMessage(null);
    }
  }, [selectedDoctor, selectedDateSlots]);

  // --- FILTRES ---
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      const patientName =
        `${appt.patient?.nom} ${appt.patient?.prenom}`.toLowerCase();
      const doctorName = `dr. ${appt.slot?.doctor?.nom}`.toLowerCase();
      const searchMatch =
        patientName.includes(searchAppt.toLowerCase()) ||
        doctorName.includes(searchAppt.toLowerCase()) ||
        appt.id.toString().includes(searchAppt);

      const statusMatch =
        statusFilterAppt === "ALL" || appt.status === statusFilterAppt;
      const insuranceMatch =
        insuranceFilterAppt === "ALL" ||
        (insuranceFilterAppt === "WITH" && appt.has_insurance) ||
        (insuranceFilterAppt === "WITHOUT" && !appt.has_insurance);

      const dateMatch =
        !dateFilterAppt || appt.slot?.date_consultation === dateFilterAppt;

      return searchMatch && statusMatch && insuranceMatch && dateMatch;
    });
  }, [
    appointments,
    searchAppt,
    statusFilterAppt,
    insuranceFilterAppt,
    dateFilterAppt,
  ]);

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const fullName = `${doc.nom} ${doc.prenom}`.toLowerCase();
      const searchMatch = fullName.includes(searchDoctor.toLowerCase());
      const specMatch =
        specialityFilter === "ALL" ||
        String(doc.speciality_id) === String(specialityFilter);
      return searchMatch && specMatch;
    });
  }, [doctors, searchDoctor, specialityFilter]);

  const getInsuranceDocumentUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    const cleanPath = path.replace(/^public\//, "");
    return `${STORAGE_BASE_URL}/${cleanPath}`;
  };

  // --- GESTION DES SÉLECTIONS DE CRÉNEAUX ---
  const handleToggleSlotSelection = (slotId) => {
    setSelectedSlotIds((prev) =>
      prev.includes(slotId)
        ? prev.filter((id) => id !== slotId)
        : [...prev, slotId],
    );
  };

  // --- BLOCAGE (Toute la journée OU Sélection) ---
  const handleBlockAction = (isFullDay = false) => {
    if (!isFullDay && selectedSlotIds.length === 0) {
      return alert("Veuillez sélectionner au moins un créneau à bloquer.");
    }

    const reason = prompt(
      isFullDay
        ? `Motif du blocage de TOUTE la journée du ${selectedDateSlots} :`
        : `Motif du blocage des ${selectedSlotIds.length} créneaux sélectionnés :`,
      "Urgence / Indisponibilité",
    );

    if (!reason) return;

    fetch(`${API_BASE_URL}/secretary/unavailabilities/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctor_id: selectedDoctor.id,
        date: selectedDateSlots,
        type: "URGENCE",
        reason,
        slot_ids: isFullDay ? null : selectedSlotIds,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert(data.message);
          setSelectedSlotIds([]);
          fetchDoctorData(selectedDoctor.id, selectedDateSlots);
          fetchData();
        }
      });
  };

  // --- DÉBLOCAGE / LEVÉE DE L'INDISPONIBILITÉ ---
  const handleUnblock = (unavailId) => {
    if (
      !window.confirm(
        "Voulez-vous débloquer cette période et réouvrir les créneaux ?",
      )
    )
      return;

    fetch(`${API_BASE_URL}/secretary/unavailabilities/${unavailId}/unblock`, {
      method: "POST",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert(data.message);
          fetchDoctorData(selectedDoctor.id, selectedDateSlots);
          fetchData();
        }
      });
  };
  // --- MARQUER COMME TERMINÉ OU ABSENT ---
  const handleUpdateStatus = async (appointmentId, newStatus) => {
    const statusLabel = newStatus === "TERMINE" ? "Terminé" : "Patient Absent";
    if (
      !window.confirm(
        `Voulez-vous marquer ce rendez-vous comme "${statusLabel}" ?`,
      )
    )
      return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/secretary/appointments/${appointmentId}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      ).then((r) => r.json());

      if (res.success) {
        fetchData(); // Rafraîchit la liste des rendez-vous
      } else {
        alert(res.message || "Erreur lors de la mise à jour du statut.");
      }
    } catch (err) {
      console.error("Erreur mise à jour statut :", err);
      alert("Erreur de connexion au serveur.");
    }
  };
  // --- VALIDATION / REFUS ASSURANCE ---
  const handleValidateInsurance = () => {
    fetch(`${API_BASE_URL}/secretary/validate-insurance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointment_id: selectedAppointment.id,
        insurance_coverage_rate: parseInt(coverageRate),
      }),
    }).then(() => {
      setSelectedAppointment(null);
      setCoverageRate("");
      fetchData();
    });
  };

  const handleRejectInsurance = () => {
    fetch(`${API_BASE_URL}/secretary/reject-insurance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointment_id: selectedAppointment.id,
        reason: cancellationReason,
      }),
    }).then(() => {
      setSelectedAppointment(null);
      setCancellationReason("");
      fetchData();
    });
  };

  // --- GESTION DES DISPONIBILITÉS RÉCURRENTE ET GÉNÉRATION ---
  const addAvailabilityRow = () => {
    setWeeklyAvailabilities([
      ...weeklyAvailabilities,
      { day_of_week: 1, start_time: "08:00", end_time: "12:00" },
    ]);
  };

  const removeAvailabilityRow = (index) => {
    const updated = [...weeklyAvailabilities];
    updated.splice(index, 1);
    setWeeklyAvailabilities(updated);
  };

  const handleAvailabilityChange = (index, field, value) => {
    const updated = [...weeklyAvailabilities];
    updated[index][field] = value;
    setWeeklyAvailabilities(updated);
  };

  const handleSaveAvailabilities = async () => {
    if (!selectedDoctor) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/secretary/doctors/${selectedDoctor.id}/availabilities`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ availabilities: weeklyAvailabilities }),
        },
      ).then((r) => r.json());

      if (res.success) {
        alert("Modèle récurrent enregistré avec succès !");
      }
    } catch (err) {
      alert("Erreur d'enregistrement.");
    }
  };

  const handleGenerateSlots = async () => {
    if (!selectedDoctor || !startDateGen || !endDateGen) {
      return alert("Veuillez remplir les dates de début et de fin.");
    }
    setGenMessage({ type: "info", text: "Génération en cours..." });
    try {
      const res = await fetch(`${API_BASE_URL}/secretary/slots/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_id: selectedDoctor.id,
          start_date: startDateGen,
          end_date: endDateGen,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setGenMessage({ type: "success", text: res.message });
        fetchDoctorData(selectedDoctor.id, selectedDateSlots);
      } else {
        setGenMessage({ type: "danger", text: res.message });
      }
    } catch (err) {
      setGenMessage({ type: "danger", text: "Erreur lors de la génération." });
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center text-gray-500 font-['Poppins']">
        Chargement du dashboard secrétariat...
      </div>
    );

  return (
    <div className="bg-gray-50 min-h-screen p-6 font-['Poppins'] text-gray-800">
      {/* HEADER & ONGLETS PRINCIPAUX */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-[#0D1B3D]">
            Espace Secrétariat
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Gestion des rendez-vous et des plannings
          </p>
        </div>

        <div className="flex bg-gray-100 p-1.5 rounded-xl gap-2">
          <button
            onClick={() => setActiveTab("appointments")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition ${
              activeTab === "appointments"
                ? "bg-[#0D1B3D] text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Rendez-vous ({appointments.length})
          </button>
          <button
            onClick={() => setActiveTab("doctors")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition ${
              activeTab === "doctors"
                ? "bg-[#0D1B3D] text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Médecins & Planning
          </button>
        </div>
      </div>

      {/* ONGLET 1: GESTION DES RENDEZ-VOUS */}
      {activeTab === "appointments" && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Patient, Docteur, Montant..."
              value={searchAppt}
              onChange={(e) => setSearchAppt(e.target.value)}
              className="px-4 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50"
            />

            <select
              value={statusFilterAppt}
              onChange={(e) => setStatusFilterAppt(e.target.value)}
              className="px-4 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="EN_ATTENTE_VALIDATION">
                En attente de validation
              </option>
              <option value="EN_ATTENTE_PAIEMENT">
                En attente de paiement
              </option>
              <option value="CONFIRME">Confirmé</option>
              <option value="TERMINE">Terminé</option>
              <option value="ABSENT">Absent</option>
              <option value="ANNULE_HOPITAL">Annulé par hôpital</option>
            </select>

            <select
              value={insuranceFilterAppt}
              onChange={(e) => setInsuranceFilterAppt(e.target.value)}
              className="px-4 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50"
            >
              <option value="ALL">Toutes les assurances</option>
              <option value="WITH">Avec Assurance</option>
              <option value="WITHOUT">Sans Assurance</option>
            </select>

            <input
              type="date"
              value={dateFilterAppt}
              onChange={(e) => setDateFilterAppt(e.target.value)}
              className="px-4 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50"
            />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-400 text-[11px] font-bold uppercase border-b border-gray-100">
                  <th className="py-3.5 px-4">Demande faite le</th>
                  <th className="py-3.5 px-4">Patient</th>
                  <th className="py-3.5 px-4">Médecin</th>
                  <th className="py-3.5 px-4">Date Consult.</th>
                  <th className="py-3.5 px-4">Assurance</th>
                  <th className="py-3.5 px-4 text-right">Reste à payer</th>
                  <th className="py-3.5 px-4 text-center">Statut</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8 text-gray-400">
                      Aucun rendez-vous trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((appt) => {
                    const createdDate = appt.created_at
                      ? new Date(appt.created_at)
                      : null;
                    const formattedCreated = createdDate
                      ? `${createdDate.toLocaleDateString("fr-FR")} à ${createdDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                      : "N/A";

                    return (
                      <tr
                        key={appt.id}
                        className="hover:bg-gray-50/60 transition"
                      >
                        <td className="py-3.5 px-4 font-bold text-gray-600">
                          {formattedCreated}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-[#0D1B3D]">
                          {appt.patient?.nom} {appt.patient?.prenom}
                        </td>
                        <td className="py-3.5 px-4">
                          Dr. {appt.slot?.doctor?.nom}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-blue-900">
                          {appt.slot?.date_consultation} (
                          {appt.slot?.start_time?.substring(0, 5)})
                        </td>
                        <td className="py-3.5 px-4">
                          {appt.has_insurance ? (
                            <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-semibold">
                              {appt.insurance_name} (
                              {appt.insurance_coverage_rate}%)
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">
                              Sans assurance
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold">
                          {parseInt(appt.amount_to_pay).toLocaleString()} XOF
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                            {appt.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {appt.has_insurance &&
                          appt.status === "EN_ATTENTE_VALIDATION" ? (
                            <button
                              onClick={() => setSelectedAppointment(appt)}
                              className="bg-[#1565C0] hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-[11px] font-bold transition"
                            >
                              Valider Assurance
                            </button>
                          ) : appt.status === "CONFIRME" ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() =>
                                  handleUpdateStatus(appt.id, "TERMINE")
                                }
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition shadow-sm"
                                title="Consulation réalisée"
                              >
                                ✓ Terminé
                              </button>
                              <button
                                onClick={() =>
                                  handleUpdateStatus(appt.id, "ABSENT")
                                }
                                className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition shadow-sm"
                                title="Patient ne s'est pas présenté"
                              >
                                ✗ Absent
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-[10px] italic">
                              Aucune action
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ONGLET 2: MÉDECINS, PLANNING & HISTORIQUE DES BLOCAGES */}
      {activeTab === "doctors" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LISTE DES MÉDECINS */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-sm font-bold text-[#0D1B3D]">
              Sélectionner un médecin
            </h2>

            <input
              type="text"
              placeholder="Nom du docteur..."
              value={searchDoctor}
              onChange={(e) => setSearchDoctor(e.target.value)}
              className="w-full px-3 py-2 text-xs border rounded-xl bg-gray-50"
            />

            <select
              value={specialityFilter}
              onChange={(e) => setSpecialityFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border rounded-xl bg-gray-50 font-medium"
            >
              <option value="ALL">Toutes les spécialités</option>
              {specialities.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>

            <div className="divide-y divide-gray-100 max-h-125 overflow-y-auto">
              {filteredDoctors.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoctor(doc)}
                  className={`p-3 rounded-xl cursor-pointer transition flex justify-between items-center ${
                    selectedDoctor?.id === doc.id
                      ? "bg-blue-50 border border-blue-200"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div>
                    <p className="font-bold text-xs text-[#0D1B3D]">
                      Dr. {doc.nom} {doc.prenom}
                    </p>
                    <p className="text-[10px] text-blue-600 font-medium">
                      {doc.speciality?.nom || "Spécialité N/A"}
                    </p>
                  </div>
                  <span className="text-xs"></span>
                </div>
              ))}
            </div>
          </div>

          {/* PLANNING DU MÉDECIN + SECTION BLOCAGE & DÉBLOCAGE */}
          <div className="lg:col-span-2 space-y-6">
            {selectedDoctor ? (
              <>
                {/* BOUTON CONFIGURATION EMPLOI DU TEMPS RÉCURRENT */}
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowGenSection(!showGenSection)}
                    className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold px-4 py-2 rounded-xl border border-indigo-200 transition flex items-center gap-2"
                  >
                    {showGenSection
                      ? "Masquer la configuration des créneaux"
                      : "Configurer emploi du temps & générer créneaux"}
                  </button>
                </div>

                {/* VOLET DÉROULANT : MODÈLE RÉCURRENT & GÉNÉRATION */}
                {showGenSection && (
                  <div className="bg-indigo-50/40 p-5 rounded-2xl border border-indigo-100 space-y-4">
                    <h3 className="text-xs font-bold text-[#0D1B3D] uppercase tracking-wider">
                      1. Modèle d'Emploi du temps Récurrent (Dr.{" "}
                      {selectedDoctor.nom})
                    </h3>

                    <div className="space-y-2">
                      {weeklyAvailabilities.map((avail, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-white p-2 rounded-xl border border-indigo-50"
                        >
                          <select
                            value={avail.day_of_week}
                            onChange={(e) =>
                              handleAvailabilityChange(
                                idx,
                                "day_of_week",
                                parseInt(e.target.value),
                              )
                            }
                            className="text-xs border rounded-lg p-1.5 bg-gray-50"
                          >
                            {Object.entries(DAYS_MAP).map(([val, label]) => (
                              <option key={val} value={val}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="time"
                            value={avail.start_time}
                            onChange={(e) =>
                              handleAvailabilityChange(
                                idx,
                                "start_time",
                                e.target.value,
                              )
                            }
                            className="text-xs border rounded-lg p-1.5"
                          />
                          <span className="text-xs text-gray-400">à</span>
                          <input
                            type="time"
                            value={avail.end_time}
                            onChange={(e) =>
                              handleAvailabilityChange(
                                idx,
                                "end_time",
                                e.target.value,
                              )
                            }
                            className="text-xs border rounded-lg p-1.5"
                          />
                          <button
                            onClick={() => removeAvailabilityRow(idx)}
                            className="text-red-500 text-xs px-2 font-bold hover:text-red-700"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={addAvailabilityRow}
                        className="bg-white text-gray-700 border border-gray-200 text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-gray-50"
                      >
                        + Plage Horaire
                      </button>
                      <button
                        onClick={handleSaveAvailabilities}
                        className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-emerald-700"
                      >
                        Enregistrer le Modèle
                      </button>
                    </div>

                    <hr className="border-indigo-100 my-3" />

                    <h3 className="text-xs font-bold text-[#0D1B3D] uppercase tracking-wider">
                      2. Générer les Créneaux dans l'Agenda
                    </h3>

                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-gray-500 mb-1">
                          Du
                        </label>
                        <input
                          type="date"
                          value={startDateGen}
                          onChange={(e) => setStartDateGen(e.target.value)}
                          className="w-full text-xs border rounded-xl p-2 bg-white"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-gray-500 mb-1">
                          Au
                        </label>
                        <input
                          type="date"
                          value={endDateGen}
                          onChange={(e) => setEndDateGen(e.target.value)}
                          className="w-full text-xs border rounded-xl p-2 bg-white"
                        />
                      </div>
                      <button
                        onClick={handleGenerateSlots}
                        className="bg-[#0D1B3D] text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-blue-900 transition"
                      >
                        Générer
                      </button>
                    </div>

                    {genMessage && (
                      <p
                        className={`text-xs font-bold p-2 rounded-lg ${
                          genMessage.type === "success"
                            ? "bg-emerald-100 text-emerald-800"
                            : genMessage.type === "danger"
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {genMessage.text}
                      </p>
                    )}
                  </div>
                )}

                {/* BLOC 1 : CRÉNEAUX ET ACTIONS DE BLOCAGE */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-5">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b">
                    <div>
                      <h2 className="text-base font-bold text-[#0D1B3D]">
                        Planning : Dr. {selectedDoctor.nom}{" "}
                        {selectedDoctor.prenom}
                      </h2>
                      <p className="text-xs text-gray-400">
                        {selectedDoctor.speciality?.nom}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={selectedDateSlots}
                        onChange={(e) => setSelectedDateSlots(e.target.value)}
                        className="px-3 py-1.5 text-xs border rounded-xl bg-gray-50"
                      />
                      <button
                        onClick={() => handleBlockAction(true)}
                        className="bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold px-3 py-1.5 rounded-xl border border-red-200 transition"
                      >
                        Bloquer toute la journée
                      </button>
                    </div>
                  </div>

                  {/* BARRE D'ACTION QUAND UN OU PLUSIEURS CRÉNEAUX SONT SÉLECTIONNÉS */}
                  {selectedSlotIds.length > 0 && (
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-800">
                        {selectedSlotIds.length} créneau(x) sélectionné(s)
                      </span>
                      <button
                        onClick={() => handleBlockAction(false)}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                      >
                        Bloquer la sélection
                      </button>
                    </div>
                  )}

                  {/* GRILLE DES CRÉNEAUX */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {doctorSlots.length === 0 ? (
                      <div className="col-span-full text-center py-8 text-gray-400 text-xs">
                        Aucun créneau disponible pour cette date.
                      </div>
                    ) : (
                      doctorSlots.map((slot) => {
                        const isSelected = selectedSlotIds.includes(slot.id);
                        const isAvailable = slot.status === "Disponible";

                        return (
                          <div
                            key={slot.id}
                            onClick={() =>
                              isAvailable && handleToggleSlotSelection(slot.id)
                            }
                            className={`p-3 rounded-xl border text-center transition cursor-pointer relative ${
                              isSelected
                                ? "ring-2 ring-red-500 border-transparent bg-red-100/50"
                                : ""
                            } ${
                              isAvailable
                                ? "bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100/50"
                                : "bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed"
                            }`}
                          >
                            <p className="font-bold text-xs">
                              {slot.start_time?.substring(0, 5)} -{" "}
                              {slot.end_time?.substring(0, 5)}
                            </p>
                            <span
                              className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                isAvailable
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-gray-200 text-gray-700"
                              }`}
                            >
                              {slot.status}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* BLOC 2 : HISTORIQUE ET DÉBLOCAGE DES INDISPONIBILITÉS DU MÉDECIN */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                  <h3 className="text-sm font-bold text-[#0D1B3D]">
                    Historique des blocages du Dr. {selectedDoctor.nom}
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-gray-400 text-[10px] font-bold uppercase border-b">
                          <th className="py-2.5 px-3">Période</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Motif</th>
                          <th className="py-2.5 px-3 text-center">Statut</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {doctorUnavailabilities.length === 0 ? (
                          <tr>
                            <td
                              colSpan="5"
                              className="text-center py-6 text-gray-400"
                            >
                              Aucun blocage répertorié pour ce médecin.
                            </td>
                          </tr>
                        ) : (
                          doctorUnavailabilities.map((u) => (
                            <tr key={u.id}>
                              <td className="py-3 px-3 font-semibold text-gray-700">
                                {u.is_full_day
                                  ? `Journée du ${u.start_datetime.substring(0, 10)}`
                                  : `Le ${u.start_datetime.substring(0, 10)} (${u.start_datetime.substring(11, 16)} à ${u.end_datetime.substring(11, 16)})`}
                              </td>
                              <td className="py-3 px-3 text-amber-700 font-medium">
                                {u.type}
                              </td>
                              <td className="py-3 px-3">
                                {u.reason || "Non précisé"}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    u.status === "ACTIF"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-gray-100 text-gray-500"
                                  }`}
                                >
                                  {u.status === "ACTIF" ? "BLOQUÉ" : "DÉBLOQUÉ"}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                {u.status === "ACTIF" && (
                                  <button
                                    onClick={() => handleUnblock(u.id)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-[10px] font-bold transition"
                                  >
                                    Débloquer
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center text-gray-400 text-xs">
                Veuillez sélectionner un médecin dans la liste de gauche pour
                afficher son planning et ses indisponibilités.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALE TRAITEMENT ASSURANCE */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#0D1B3D]">
              Traitement Assurance — RDV #{selectedAppointment.id}
            </h3>

            <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-2">
              <div className="text-xs">
                <span className="font-semibold text-gray-600">
                  Assurance :{" "}
                </span>
                <span className="font-bold text-[#0D1B3D]">
                  {selectedAppointment.insurance_name || "N/A"}
                </span>
                {selectedAppointment.insurance_policy_number && (
                  <span className="block text-[11px] text-gray-500">
                    N° Police: {selectedAppointment.insurance_policy_number}
                  </span>
                )}
              </div>

              {selectedAppointment.insurance_document_path ? (
                <a
                  href={getInsuranceDocumentUrl(
                    selectedAppointment.insurance_document_path,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-2 rounded-lg w-full justify-center transition border border-blue-100"
                >
                  Consulter la pièce jointe
                </a>
              ) : (
                <p className="text-xs text-amber-600 italic">
                  Aucun document téléversé.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsRejecting(false)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${!isRejecting ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-gray-50 text-gray-600"}`}
              >
                Accepter
              </button>
              <button
                onClick={() => setIsRejecting(true)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${isRejecting ? "bg-red-50 text-red-700 border-red-300" : "bg-gray-50 text-gray-600"}`}
              >
                Refuser
              </button>
            </div>

            {!isRejecting ? (
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  Taux de couverture (%)
                </label>
                <input
                  type="number"
                  placeholder="ex: 80"
                  value={coverageRate}
                  onChange={(e) => setCoverageRate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  Motif du refus
                </label>
                <input
                  type="text"
                  placeholder="ex: Document illisible"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setSelectedAppointment(null)}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700"
              >
                Annuler
              </button>
              <button
                onClick={
                  !isRejecting ? handleValidateInsurance : handleRejectInsurance
                }
                className="px-4 py-2 text-xs font-bold bg-[#0D1B3D] hover:bg-blue-900 text-white rounded-xl transition"
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
