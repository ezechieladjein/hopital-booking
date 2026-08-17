// src/SecretaryDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import { apiFetch } from "./api";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useTheme } from './context/ThemeContext';

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

const ITEMS_PER_PAGE = 10;

export default function SecretaryDashboard() {
  const { darkMode } = useTheme();
  const [activeTab, setActiveTab] = useState("appointments");

  // --- RENDEZ-VOUS ---
  const [appointments, setAppointments] = useState([]);
  const [searchAppt, setSearchAppt] = useState("");
  const [statusFilterAppt, setStatusFilterAppt] = useState("ALL");
  const [insuranceFilterAppt, setInsuranceFilterAppt] = useState("ALL");
  const [dateFilterAppt, setDateFilterAppt] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // --- MÉDECINS & PLANNING ---
  const [doctors, setDoctors] = useState([]);
  const [specialities, setSpecialities] = useState([]);
  const [catalogData, setCatalogData] = useState([]);
  const [searchDoctor, setSearchDoctor] = useState("");
  const [specialityFilter, setSpecialityFilter] = useState("ALL");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorAvailableDates, setDoctorAvailableDates] = useState([]);
  const [doctorSelectedDate, setDoctorSelectedDate] = useState("");
  const [doctorSlots, setDoctorSlots] = useState([]);
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);

  // --- HISTORIQUE DES BLOCAGES ---
  const [doctorUnavailabilities, setDoctorUnavailabilities] = useState([]);

  // --- EMPLOI DU TEMPS RÉCURRENT ---
  const [weeklyAvailabilities, setWeeklyAvailabilities] = useState([]);
  const [startDateGen, setStartDateGen] = useState("");
  const [endDateGen, setEndDateGen] = useState("");
  const [genMessage, setGenMessage] = useState(null);
  const [showGenSection, setShowGenSection] = useState(false);

  // --- MODALE TRAITEMENT ASSURANCE ---
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [coverageRate, setCoverageRate] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // --- PAGE 3: CRÉER UN RENDEZ-VOUS & GESTION GUICHET ---
  const [bookingStep, setBookingStep] = useState(1);
  const [patientSelectionMode, setPatientSelectionMode] = useState("existing");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [patientSearchTerm, setPatientSearchTerm] = useState("");
  const [patientsList, setPatientsList] = useState([]);
  const [foundPatient, setFoundPatient] = useState(null);

  const [selectedSpecialityId, setSelectedSpecialityId] = useState("");

  const [patientFormData, setPatientFormData] = useState({
    nom: "",
    prenom: "",
    telephone: "",
    email: "",
    sexe: "M",
    age: "",
  });

  const [counterDoctorId, setCounterDoctorId] = useState("");
  const [counterDate, setCounterDate] = useState("");
  const [counterSlots, setCounterSlots] = useState([]);
  const [counterSelectedSlot, setCounterSelectedSlot] = useState(null);

  const [counterHasInsurance, setCounterHasInsurance] = useState(false);
  const [counterInsuranceName, setCounterInsuranceName] = useState("");
  const [counterInsurancePolicy, setCounterInsurancePolicy] = useState("");
  const [counterInsuranceRate, setCounterInsuranceRate] = useState("0");

  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [secretaryHistory, setSecretaryHistory] = useState([]);

  // --- ÉTATS MODIFICATION / ANNULATION ASSISTÉE ---
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [editDoctorId, setEditDoctorId] = useState("");
  const [editSlots, setEditSlots] = useState([]);
  const [editSelectedSlot, setEditSelectedSlot] = useState(null);

  // ================================================================
  // CHARGEMENT DES DONNÉES
  // ================================================================

  const fetchPatientsList = async () => {
    try {
      const res = await apiFetch("/secretary/patients");
      if (res?.success) setPatientsList(res.data || []);
    } catch (err) {
      console.error("Erreur récupération des patients:", err);
    }
  };

  const fetchSecretaryHistory = async () => {
    try {
      const res = await apiFetch("/secretary/history");
      if (res?.success) setSecretaryHistory(res.data || []);
    } catch (err) {
      console.error("Erreur chargement historique guichet:", err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resAppts, resDocs, resCatalog] = await Promise.all([
        apiFetch("/secretary/appointments"),
        apiFetch("/secretary/doctors"),
        apiFetch("/catalog"),
      ]);

      if (resAppts?.success) setAppointments(resAppts.data);
      if (resDocs?.success) setDoctors(resDocs.data);
      if (resCatalog?.success) {
        setSpecialities(resCatalog.data.specialities || resCatalog.data || []);
        setCatalogData(resCatalog.data || []);
      }
    } catch (err) {
      console.error("Erreur chargement données:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchSecretaryHistory();
    fetchPatientsList();
  }, []);

  // RECUPERATION PLANNING MEDECIN
  const fetchDoctorData = (doctorId, date) => {
    apiFetch(`/doctors/${doctorId}/slots?date=${date}`)
      .then((data) => {
        if (data?.success) setDoctorSlots(data.data || []);
      })
      .catch(() => setDoctorSlots([]));

    apiFetch(`/secretary/doctors/${doctorId}/unavailabilities`)
      .then((data) => {
        if (data?.success) setDoctorUnavailabilities(data.data || []);
      })
      .catch(() => setDoctorUnavailabilities([]));

    apiFetch(`/secretary/doctors/${doctorId}/availabilities`)
      .then((data) => {
        if (data?.success) setWeeklyAvailabilities(data.data || []);
      })
      .catch(() => setWeeklyAvailabilities([]));
  };

  // EFFET POUR CHARGER LES DATES DISPONIBLES DU MÉDECIN (Page 2)
  useEffect(() => {
    if (selectedDoctor) {
      let allSlots = [];
      catalogData.forEach((speciality) => {
        speciality.doctors?.forEach((doctor) => {
          if (String(doctor.id) === String(selectedDoctor.id)) {
            allSlots = doctor.slots || [];
          }
        });
      });

      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const availableSlots = allSlots.filter((slot) => {
        if (slot.status !== "Disponible") return false;
        if (slot.date_consultation < todayStr) return false;
        if (slot.date_consultation === todayStr && slot.start_time.substring(0, 5) <= currentTimeStr) return false;
        return true;
      });

      const dates = new Set();
      availableSlots.forEach((slot) => {
        dates.add(slot.date_consultation);
      });
      const sortedDates = Array.from(dates).sort();

      setDoctorAvailableDates(sortedDates);

      if (sortedDates.length > 0) {
        const firstDate = sortedDates[0];
        setDoctorSelectedDate(firstDate);
        fetchDoctorData(selectedDoctor.id, firstDate);
      } else {
        setDoctorSelectedDate("");
        setDoctorSlots([]);
      }

      setSelectedSlotIds([]);
      setGenMessage(null);
    }
  }, [selectedDoctor, catalogData]);

  // EFFET POUR CHARGER LES CRÉNEAUX DEPUIS LE CATALOGUE (Page 3)
  useEffect(() => {
    if (counterDoctorId) {
      let allSlots = [];
      catalogData.forEach((speciality) => {
        speciality.doctors?.forEach((doctor) => {
          if (String(doctor.id) === String(counterDoctorId)) {
            allSlots = doctor.slots || [];
          }
        });
      });

      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const availableSlots = allSlots.filter((slot) => {
        if (slot.status !== "Disponible") return false;
        if (slot.date_consultation < todayStr) return false;
        if (slot.date_consultation === todayStr && slot.start_time.substring(0, 5) <= currentTimeStr) return false;
        return true;
      });

      setCounterSlots(availableSlots);
      setCounterDate("");
      setCounterSelectedSlot(null);
    }
  }, [counterDoctorId, catalogData]);

  // Chargement des créneaux pour modification assistée
  useEffect(() => {
    if (editDoctorId && editDate) {
      apiFetch(`/doctors/${editDoctorId}/slots?date=${editDate}`)
        .then((data) => {
          if (data?.success) setEditSlots(data.data || []);
        })
        .catch(() => setEditSlots([]));
    }
  }, [editDoctorId, editDate]);

  // FILTRES DE RECHERCHE
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

  // Pagination
  const totalPages = Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE) || 1;
  const paginatedAppointments = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAppointments.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAppointments, currentPage]);

  // Réinitialiser la page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [searchAppt, statusFilterAppt, insuranceFilterAppt, dateFilterAppt]);

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

  // Filtrage des patients existants pour la Page 3 avec recherche dynamique
  const filteredPatients = useMemo(() => {
    if (patientSearchTerm.length < 2) return [];
    return patientsList.filter((p) => {
      const fullname = `${p.nom} ${p.prenom}`.toLowerCase();
      const phone = p.telephone || "";
      return (
        fullname.includes(patientSearchTerm.toLowerCase()) ||
        phone.includes(patientSearchTerm)
      );
    });
  }, [patientsList, patientSearchTerm]);

  // Calcul des dates disponibles pour le médecin sélectionné (Page 3)
  const availableDates = useMemo(() => {
    if (!counterDoctorId || counterSlots.length === 0) return [];

    const dates = new Set();
    counterSlots.forEach((slot) => {
      if (slot.status === "Disponible") {
        dates.add(slot.date_consultation);
      }
    });
    return Array.from(dates).sort();
  }, [counterDoctorId, counterSlots]);

  // GESTION BLOCAGE ET DÉBLOCAGE
  const handleToggleSlotSelection = (slotId) => {
    setSelectedSlotIds((prev) =>
      prev.includes(slotId)
        ? prev.filter((id) => id !== slotId)
        : [...prev, slotId]
    );
  };

  const handleBlockAction = async (isFullDay) => {
    try {
      const formattedDate =
        typeof doctorSelectedDate === "string" && doctorSelectedDate.includes("T")
          ? doctorSelectedDate.split("T")[0]
          : doctorSelectedDate;

      const formattedSlotIds = isFullDay
        ? []
        : selectedSlotIds.map((slot) =>
          typeof slot === "object" ? slot.id : slot
        );

      const payload = {
        doctor_id: selectedDoctor?.id,
        date: formattedDate,
        type: "URGENCE",
        reason: "Indisponibilité déclarée",
        slot_ids: formattedSlotIds,
      };

      const data = await apiFetch("/secretary/unavailabilities/block", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (data?.success) {
        alert(data.message);
        setSelectedSlotIds([]);
        fetchDoctorData(selectedDoctor.id, formattedDate);
      }
    } catch (error) {
      alert(error.message || "Erreur lors du blocage");
    }
  };

  const handleUnblock = async (unavailId) => {
    if (!window.confirm("Voulez-vous débloquer cette période ?")) return;
    try {
      const data = await apiFetch(
        `/secretary/unavailabilities/${unavailId}/unblock`,
        { method: "POST" }
      );
      if (data?.success) {
        alert(data.message);
        fetchDoctorData(selectedDoctor.id, doctorSelectedDate);
        fetchData();
      }
    } catch (error) {
      alert(error.message || "Erreur lors du déblocage");
    }
  };

  const handleUpdateStatus = async (appointmentId, newStatus) => {
    const statusLabel = newStatus === "TERMINE" ? "Terminé" : "Patient Absent";
    if (!window.confirm(`Marquer ce rendez-vous comme "${statusLabel}" ?`)) return;

    try {
      const data = await apiFetch(
        `/secretary/appointments/${appointmentId}/status`,
        {
          method: "POST",
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (data?.success) fetchData();
      else alert(data?.message || "Erreur de mise à jour.");
    } catch (err) {
      alert("Erreur de connexion au serveur.");
    }
  };

  // ASSURANCES
  const handleValidateInsurance = () => {
    apiFetch("/secretary/validate-insurance", {
      method: "POST",
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
    apiFetch("/secretary/reject-insurance", {
      method: "POST",
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

  // PLANIFICATION RÉCURRENTE
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
      const data = await apiFetch(
        `/secretary/doctors/${selectedDoctor.id}/availabilities`,
        {
          method: "POST",
          body: JSON.stringify({ availabilities: weeklyAvailabilities }),
        }
      );
      if (data?.success) alert("Modèle récurrent enregistré !");
    } catch (err) {
      alert("Erreur d'enregistrement.");
    }
  };

  const isAppointmentStarted = (dateConsultation, startTime) => {
    if (!dateConsultation || !startTime) return false;
    const formattedStartTime =
      startTime.length === 5 ? `${startTime}:00` : startTime;
    return new Date() >= new Date(`${dateConsultation}T${formattedStartTime}`);
  };

  const handleGenerateSlots = async () => {
    if (!selectedDoctor || !startDateGen || !endDateGen) {
      return alert("Veuillez remplir les dates de début et de fin.");
    }
    setGenMessage({ type: "info", text: "Génération en cours..." });
    try {
      const data = await apiFetch("/secretary/slots/generate", {
        method: "POST",
        body: JSON.stringify({
          doctor_id: selectedDoctor.id,
          start_date: startDateGen,
          end_date: endDateGen,
        }),
      });

      if (data?.success) {
        setGenMessage({ type: "success", text: data.message });
        fetchDoctorData(selectedDoctor.id, doctorSelectedDate);
      } else {
        setGenMessage({ type: "danger", text: data.message });
      }
    } catch (err) {
      setGenMessage({ type: "danger", text: "Erreur lors de la génération." });
    }
  };

  // ================================================================
  // ACTIONS PAGE 3: CRÉER UN RENDEZ-VOUS
  // ================================================================

  const handleSelectOrRegisterPatient = async () => {
    if (patientSelectionMode === "existing") {
      if (!selectedPatientId) {
        return alert("Veuillez choisir un patient dans la liste.");
      }
      const patientObj = patientsList.find(
        (p) => String(p.id) === String(selectedPatientId)
      );
      if (patientObj) {
        setFoundPatient(patientObj);
        setBookingStep(2);
      }
    } else {
      if (!patientFormData.nom || !patientFormData.prenom || !patientFormData.telephone) {
        return alert("Veuillez renseigner au moins le nom, prénom et téléphone.");
      }
      try {
        const res = await apiFetch("/secretary/patients/search-or-create", {
          method: "POST",
          body: JSON.stringify(patientFormData),
        });

        if (res?.success) {
          setFoundPatient(res.data);
          alert(`Nouveau patient enregistré : ${res.data.nom} ${res.data.prenom}`);
          fetchPatientsList();
          setBookingStep(2);
        }
      } catch (err) {
        alert("Erreur lors de la création du patient.");
      }
    }
  };

  const loadSlotsForDate = (doctorId, date) => {
    if (doctorId && date) {
      apiFetch(`/doctors/${doctorId}/slots?date=${date}`)
        .then((data) => {
          if (data?.success) {
            const available = data.data.filter((slot) => slot.status === "Disponible");
            setCounterSlots(available);
          }
        })
        .catch(() => setCounterSlots([]));
    }
  };

  const handleAssistedBookingSubmit = async (e) => {
    e.preventDefault();
    if (!foundPatient || !counterSelectedSlot) {
      return alert("Veuillez sélectionner un patient et un créneau.");
    }

    setIsSubmittingBooking(true);
    try {
      const formData = new FormData();
      formData.append("patient_id", foundPatient.id);
      formData.append("slot_id", counterSelectedSlot.id);
      formData.append("has_insurance", counterHasInsurance ? "1" : "0");

      if (counterHasInsurance) {
        formData.append("insurance_name", counterInsuranceName);
        formData.append("insurance_policy_number", counterInsurancePolicy);
        formData.append("insurance_coverage_rate", counterInsuranceRate);
      }

      console.log("📤 Envoi du RDV...", {
        patient_id: foundPatient.id,
        slot_id: counterSelectedSlot.id,
        has_insurance: counterHasInsurance,
      });

      const res = await apiFetch("/secretary/appointments/assisted-book", {
        method: "POST",
        body: formData,
      });

      console.log("📥 Réponse RDV:", res);

      if (res?.success) {
        const appointmentId = res.data?.appointment_id || res.data?.appointment?.id;
        const amountToPay = res.data?.amount_to_pay || res.data?.appointment?.amount_to_pay || 0;

        console.log("💰 Montant à payer:", amountToPay, "ID RDV:", appointmentId);

        if (amountToPay > 0 && appointmentId) {
          try {
            console.log("🔄 Initiation paiement FedaPay...");
            const paymentData = await apiFetch("/secretary/payments/initiate", {
              method: "POST",
              body: JSON.stringify({ appointment_id: appointmentId }),
            });

            console.log("📥 Réponse paiement:", paymentData);

            if (paymentData.success && paymentData.payment_url) {
              window.open(paymentData.payment_url, "_blank");
              alert(
                "Rendez-vous créé ! La page de paiement s'ouvre dans un nouvel onglet. " +
                "Le patient doit confirmer le paiement sur son téléphone."
              );
            } else {
              alert(
                "Rendez-vous créé mais le paiement n'a pas pu être initié. " +
                "Le rendez-vous est en attente de paiement."
              );
            }
          } catch (paymentError) {
            console.error("❌ Erreur paiement:", paymentError);
            alert(
              "Rendez-vous créé mais le paiement a échoué. " +
              "Le rendez-vous est en attente de paiement.\n" +
              "Erreur: " + (paymentError.message || "Erreur inconnue")
            );
          }
        } else if (amountToPay === 0) {
          alert("Rendez-vous créé avec succès ! (Aucun paiement requis)");
        } else {
          alert("Rendez-vous créé avec succès !");
        }

        // Réinitialisation du formulaire
        setBookingStep(1);
        setFoundPatient(null);
        setCounterSelectedSlot(null);
        setSelectedPatientId("");
        setSelectedSpecialityId("");
        setPatientFormData({
          nom: "",
          prenom: "",
          telephone: "",
          email: "",
          sexe: "M",
          age: "",
        });
        setCounterHasInsurance(false);
        setCounterInsuranceName("");
        setCounterInsurancePolicy("");
        setCounterInsuranceRate("0");
        setCounterDoctorId("");
        setCounterDate("");
        setCounterSlots([]);
        fetchData();
        fetchSecretaryHistory();
      } else {
        alert(res?.message || "Erreur lors de la réservation.");
      }
    } catch (err) {
      console.error("❌ Erreur globale:", err);
      alert("Erreur de connexion au serveur. Détail: " + (err.message || "Erreur inconnue"));
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // --- ACTIONS DÉDIÉES : MODIFICATION ET ANNULATION ASSISTÉE ---
  const handleOpenEditModal = (item) => {
    setEditingAppointment(item);
    setEditDoctorId(item.slot?.doctor_id || item.slot?.doctor?.id || "");
    setEditDate(item.slot?.date_consultation || new Date().toISOString().split("T")[0]);
    setEditSelectedSlot(null);
  };

  const handleUpdateAssistedAppointment = async () => {
    if (!editSelectedSlot) return alert("Sélectionnez un nouveau créneau.");
    try {
      const res = await apiFetch(
        `/secretary/appointments/${editingAppointment.id}/assisted-reschedule`,
        {
          method: "PUT",
          body: JSON.stringify({ slot_id: editSelectedSlot.id }),
        }
      );
      if (res?.success) {
        alert("Rendez-vous modifié avec succès !");
        setEditingAppointment(null);
        fetchSecretaryHistory();
        fetchData();
      }
    } catch (err) {
      alert("Erreur lors de la modification du rendez-vous.");
    }
  };

  const handleCancelAssistedAppointment = async (apptId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir annuler ce rendez-vous au guichet ?"))
      return;
    try {
      const res = await apiFetch(`/secretary/appointments/${apptId}/assisted-cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "Annulation au guichet par la secrétaire" }),
      });
      if (res?.success) {
        alert("Rendez-vous annulé.");
        fetchSecretaryHistory();
        fetchData();
      }
    } catch (err) {
      alert("Erreur lors de l'annulation.");
    }
  };

  if (loading) {
    return (
      <div className={`p-8 text-center font-['Poppins'] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
        Chargement du dashboard secrétariat...
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 font-['Poppins'] ${
      darkMode ? 'bg-[#0B0F17] text-gray-200' : 'bg-gray-50 text-gray-800'
    }`}>
      {/* HEADER & ONGLETS PRINCIPAUX */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 p-6 rounded-2xl shadow-sm border ${
        darkMode 
          ? 'bg-[#1E293B] border-gray-700' 
          : 'bg-white border-gray-100'
      }`}>
        <div>
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>Espace Secrétariat</h1>
          <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
            Gestion des rendez-vous, des plannings et du guichet
          </p>
        </div>

        <div className={`flex flex-wrap p-1.5 rounded-xl gap-2 ${
          darkMode ? 'bg-[#111827]' : 'bg-gray-100'
        }`}>
          <button
            onClick={() => setActiveTab("appointments")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition ${
              activeTab === "appointments"
                ? "bg-[#0D1B3D] text-white shadow-sm"
                : darkMode 
                  ? "text-gray-400 hover:text-gray-200" 
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
                : darkMode 
                  ? "text-gray-400 hover:text-gray-200" 
                  : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Médecins & Planning
          </button>
          <button
            onClick={() => setActiveTab("create_appointment")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition ${
              activeTab === "create_appointment"
                ? "bg-[#0D1B3D] text-white shadow-sm"
                : darkMode 
                  ? "text-gray-400 hover:text-gray-200" 
                  : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Créer un rendez vous
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* ONGLET 1: GESTION DES RENDEZ-VOUS (AVEC PAGINATION) */}
      {/* ================================================================ */}
      {activeTab === "appointments" && (
        <div className="space-y-6">
          <div className={`p-4 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-4 gap-4 ${
            darkMode 
              ? 'bg-[#1E293B] border-gray-700' 
              : 'bg-white border-gray-100'
          }`}>
            <input
              type="text"
              placeholder="Patient, Docteur, Montant..."
              value={searchAppt}
              onChange={(e) => setSearchAppt(e.target.value)}
              className={`px-4 py-2 text-xs border rounded-xl ${
                darkMode 
                  ? 'bg-[#111827] border-gray-600 text-gray-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            />
            <select
              value={statusFilterAppt}
              onChange={(e) => setStatusFilterAppt(e.target.value)}
              className={`px-4 py-2 text-xs border rounded-xl ${
                darkMode 
                  ? 'bg-[#111827] border-gray-600 text-gray-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <option value="ALL">Tous les statuts</option>
              <option value="EN_ATTENTE_VALIDATION">En attente de validation</option>
              <option value="EN_ATTENTE_PAIEMENT">En attente de paiement</option>
              <option value="CONFIRME">Confirmé</option>
              <option value="TERMINE">Terminé</option>
              <option value="ABSENT">Absent</option>
              <option value="ANNULE_HOPITAL">Annulé par hôpital</option>
              <option value="ANNULE_PATIENT">Annulé par patient</option>
            </select>
            <select
              value={insuranceFilterAppt}
              onChange={(e) => setInsuranceFilterAppt(e.target.value)}
              className={`px-4 py-2 text-xs border rounded-xl ${
                darkMode 
                  ? 'bg-[#111827] border-gray-600 text-gray-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <option value="ALL">Toutes les assurances</option>
              <option value="WITH">Avec Assurance</option>
              <option value="WITHOUT">Sans Assurance</option>
            </select>
            <input
              type="date"
              value={dateFilterAppt}
              onChange={(e) => setDateFilterAppt(e.target.value)}
              className={`px-4 py-2 text-xs border rounded-xl ${
                darkMode 
                  ? 'bg-[#111827] border-gray-600 text-gray-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            />
          </div>

          <div className={`flex justify-between items-center px-1 ${darkMode ? 'text-gray-400' : ''}`}>
            <span className="text-xs font-medium">
              <strong>{filteredAppointments.length}</strong> rendez-vous trouvé(s)
            </span>
            {filteredAppointments.length > ITEMS_PER_PAGE && (
              <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Page {currentPage} / {totalPages}
              </span>
            )}
          </div>

          <div className={`rounded-2xl shadow-sm border overflow-hidden ${
            darkMode 
              ? 'bg-[#1E293B] border-gray-700' 
              : 'bg-white border-gray-100'
          }`}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`text-[11px] font-bold uppercase border-b ${
                  darkMode 
                    ? 'bg-[#111827] text-gray-400 border-gray-700' 
                    : 'bg-gray-50 text-gray-400 border-gray-100'
                }`}>
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
              <tbody className={`divide-y text-xs ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
                {paginatedAppointments.length === 0 ? (
                  <tr>
                    <td colSpan="8" className={`text-center py-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Aucun rendez-vous trouvé.
                    </td>
                  </tr>
                ) : (
                  paginatedAppointments.map((appt) => {
                    const createdDate = appt.created_at ? new Date(appt.created_at) : null;
                    const formattedCreated = createdDate
                      ? `${createdDate.toLocaleDateString("fr-FR")} à ${createdDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                      : "N/A";

                    return (
                      <tr key={appt.id} className={darkMode ? 'hover:bg-[#111827]/60' : 'hover:bg-gray-50/60 transition'}>
                        <td className={`py-3.5 px-4 font-bold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{formattedCreated}</td>
                        <td className={`py-3.5 px-4 font-bold ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>
                          {appt.patient?.nom} {appt.patient?.prenom}
                        </td>
                        <td className={`py-3.5 px-4 ${darkMode ? 'text-gray-300' : ''}`}>Dr. {appt.slot?.doctor?.nom}</td>
                        <td className={`py-3.5 px-4 font-semibold ${darkMode ? 'text-blue-400' : 'text-blue-900'}`}>
                          {appt.slot?.date_consultation} ({appt.slot?.start_time?.substring(0, 5)})
                        </td>
                        <td className="py-3.5 px-4">
                          {appt.has_insurance ? (
                            <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-semibold">
                              {appt.insurance_name} ({appt.insurance_coverage_rate}%)
                            </span>
                          ) : (
                            <span className={`italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Sans assurance</span>
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
                          {appt.has_insurance && appt.status === "EN_ATTENTE_VALIDATION" ? (
                            <button
                              onClick={() => setSelectedAppointment(appt)}
                              className="bg-[#1565C0] hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-[11px] font-bold transition"
                            >
                              Valider Assurance
                            </button>
                          ) : appt.status === "CONFIRME" ? (
                            (() => {
                              const canChangeStatus = isAppointmentStarted(
                                appt.slot?.date_consultation,
                                appt.slot?.start_time
                              );

                              return (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    disabled={!canChangeStatus}
                                    onClick={() => handleUpdateStatus(appt.id, "TERMINE")}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition shadow-sm ${
                                      canChangeStatus
                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                        : "bg-gray-200 text-gray-400 cursor-not-allowed opacity-60"
                                    }`}
                                  >
                                    ✓ Terminé
                                  </button>
                                  <button
                                    disabled={!canChangeStatus}
                                    onClick={() => handleUpdateStatus(appt.id, "ABSENT")}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition shadow-sm ${
                                      canChangeStatus
                                        ? "bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
                                        : "bg-gray-200 text-gray-400 cursor-not-allowed opacity-60"
                                    }`}
                                  >
                                    ✗ Absent
                                  </button>
                                </div>
                              );
                            })()
                          ) : (
                            <span className={`text-[10px] italic ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>Aucune action</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={`flex items-center justify-between p-4 rounded-2xl shadow-sm border ${
              darkMode 
                ? 'bg-[#1E293B] border-gray-700' 
                : 'bg-white border-gray-100'
            }`}>
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition ${
                  darkMode 
                    ? 'bg-[#111827] border-gray-600 text-gray-300 hover:bg-gray-700' 
                    : 'bg-gray-50 border hover:bg-gray-100'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Précédent
              </button>

              <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Page <strong className={darkMode ? 'text-white' : 'text-gray-900'}>{currentPage}</strong> sur{" "}
                <strong>{totalPages}</strong>
              </span>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition ${
                  darkMode 
                    ? 'bg-[#111827] border-gray-600 text-gray-300 hover:bg-gray-700' 
                    : 'bg-gray-50 border hover:bg-gray-100'
                }`}
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* ONGLET 2: MÉDECINS, PLANNING & HISTORIQUE DES BLOCAGES */}
      {/* ================================================================ */}
      {activeTab === "doctors" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`p-5 rounded-2xl shadow-sm border space-y-4 ${
            darkMode 
              ? 'bg-[#1E293B] border-gray-700' 
              : 'bg-white border-gray-100'
          }`}>
            <h2 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>Sélectionner un médecin</h2>

            <input
              type="text"
              placeholder="Nom du docteur..."
              value={searchDoctor}
              onChange={(e) => setSearchDoctor(e.target.value)}
              className={`w-full px-3 py-2 text-xs border rounded-xl ${
                darkMode 
                  ? 'bg-[#111827] border-gray-600 text-gray-200' 
                  : 'bg-gray-50'
              }`}
            />

            <select
              value={specialityFilter}
              onChange={(e) => setSpecialityFilter(e.target.value)}
              className={`w-full px-3 py-2 text-xs border rounded-xl font-medium ${
                darkMode 
                  ? 'bg-[#111827] border-gray-600 text-gray-200' 
                  : 'bg-gray-50'
              }`}
            >
              <option value="ALL">Toutes les spécialités</option>
              {specialities.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>

            <div className={`divide-y max-h-125 overflow-y-auto ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
              {filteredDoctors.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoctor(doc)}
                  className={`p-3 rounded-xl cursor-pointer transition flex justify-between items-center ${
                    selectedDoctor?.id === doc.id
                      ? darkMode ? 'bg-blue-900/30 border border-blue-700' : 'bg-blue-50 border border-blue-200'
                      : darkMode ? 'hover:bg-[#111827]' : 'hover:bg-gray-50'
                  }`}
                >
                  <div>
                    <p className={`font-bold text-xs ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>
                      Dr. {doc.nom} {doc.prenom}
                    </p>
                    <p className={`text-[10px] font-medium ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      {doc.speciality?.nom || "Spécialité N/A"}
                    </p>
                  </div>
                  {doctorAvailableDates.length > 0 && selectedDoctor?.id === doc.id && (
                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      {doctorAvailableDates.length} dates
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {selectedDoctor ? (
              <>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowGenSection(!showGenSection)}
                    className={`text-xs font-bold px-4 py-2 rounded-xl border transition flex items-center gap-2 ${
                      darkMode 
                        ? 'bg-indigo-900/30 text-indigo-300 border-indigo-800 hover:bg-indigo-900/50' 
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    {showGenSection
                      ? "Masquer la configuration des créneaux"
                      : "Configurer emploi du temps & générer créneaux"}
                  </button>
                </div>

                {showGenSection && (
                  <div className={`p-5 rounded-2xl border space-y-4 ${
                    darkMode 
                      ? 'bg-indigo-900/20 border-indigo-800' 
                      : 'bg-indigo-50/40 border-indigo-100'
                  }`}>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>
                      1. Modèle d'Emploi du temps Récurrent (Dr. {selectedDoctor.nom})
                    </h3>

                    <div className="space-y-2">
                      {weeklyAvailabilities.map((avail, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 p-2 rounded-xl border ${
                            darkMode 
                              ? 'bg-[#111827] border-gray-700' 
                              : 'bg-white border-indigo-50'
                          }`}
                        >
                          <select
                            value={avail.day_of_week}
                            onChange={(e) =>
                              handleAvailabilityChange(
                                idx,
                                "day_of_week",
                                parseInt(e.target.value)
                              )
                            }
                            className={`text-xs border rounded-lg p-1.5 ${
                              darkMode 
                                ? 'bg-[#111827] border-gray-600 text-gray-200' 
                                : 'bg-gray-50'
                            }`}
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
                              handleAvailabilityChange(idx, "start_time", e.target.value)
                            }
                            className={`text-xs border rounded-lg p-1.5 ${
                              darkMode 
                                ? 'bg-[#111827] border-gray-600 text-gray-200' 
                                : 'bg-white'
                            }`}
                          />
                          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>à</span>
                          <input
                            type="time"
                            value={avail.end_time}
                            onChange={(e) =>
                              handleAvailabilityChange(idx, "end_time", e.target.value)
                            }
                            className={`text-xs border rounded-lg p-1.5 ${
                              darkMode 
                                ? 'bg-[#111827] border-gray-600 text-gray-200' 
                                : 'bg-white'
                            }`}
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
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
                          darkMode 
                            ? 'bg-[#111827] text-gray-300 border-gray-600 hover:bg-gray-700' 
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
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

                    <hr className={darkMode ? 'border-gray-700' : 'border-indigo-100'} />

                    <h3 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>
                      2. Générer les Créneaux dans l'Agenda
                    </h3>

                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1">
                        <label className={`block text-[10px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Du
                        </label>
                        <input
                          type="date"
                          value={startDateGen}
                          onChange={(e) => setStartDateGen(e.target.value)}
                          className={`w-full text-xs border rounded-xl p-2 ${
                            darkMode 
                              ? 'bg-[#111827] border-gray-600 text-gray-200' 
                              : 'bg-white'
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className={`block text-[10px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Au
                        </label>
                        <input
                          type="date"
                          value={endDateGen}
                          onChange={(e) => setEndDateGen(e.target.value)}
                          className={`w-full text-xs border rounded-xl p-2 ${
                            darkMode 
                              ? 'bg-[#111827] border-gray-600 text-gray-200' 
                              : 'bg-white'
                          }`}
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

                <div className={`p-6 rounded-2xl shadow-sm border space-y-5 ${
                  darkMode 
                    ? 'bg-[#1E293B] border-gray-700' 
                    : 'bg-white border-gray-100'
                }`}>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b">
                    <div>
                      <h2 className={`text-base font-bold ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>
                        Planning : Dr. {selectedDoctor.nom} {selectedDoctor.prenom}
                      </h2>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
                        {selectedDoctor.speciality?.nom}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {doctorAvailableDates.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px] overflow-x-auto">
                          {doctorAvailableDates.map((date) => (
                            <button
                              key={date}
                              onClick={() => {
                                setDoctorSelectedDate(date);
                                setSelectedSlotIds([]);
                                fetchDoctorData(selectedDoctor.id, date);
                              }}
                              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition whitespace-nowrap ${
                                doctorSelectedDate === date
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : darkMode
                                    ? "bg-[#111827] text-gray-300 border-gray-600 hover:border-blue-400 hover:bg-blue-900/30"
                                    : "bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                              }`}
                            >
                              {new Date(date).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "short",
                              })}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Aucune date disponible</span>
                      )}

                      <button
                        onClick={() => handleBlockAction(true)}
                        className="bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold px-3 py-1.5 rounded-xl border border-red-200 transition"
                      >
                        Bloquer toute la journée
                      </button>
                    </div>
                  </div>

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

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {doctorSlots.length === 0 ? (
                      <div className={`col-span-full text-center py-8 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
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
                                ? darkMode
                                  ? "bg-emerald-900/20 border-emerald-800 hover:bg-emerald-900/30"
                                  : "bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100/50"
                                : darkMode
                                  ? "bg-gray-800 border-gray-700 opacity-60 cursor-not-allowed"
                                  : "bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed"
                            }`}
                          >
                            <p className={`font-bold text-xs ${darkMode ? 'text-gray-200' : ''}`}>
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

                <div className={`p-6 rounded-2xl shadow-sm border space-y-4 ${
                  darkMode 
                    ? 'bg-[#1E293B] border-gray-700' 
                    : 'bg-white border-gray-100'
                }`}>
                  <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>
                    Historique des blocages du Dr. {selectedDoctor.nom}
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className={`text-[10px] font-bold uppercase border-b ${
                          darkMode 
                            ? 'bg-[#111827] text-gray-400 border-gray-700' 
                            : 'bg-gray-50 text-gray-400 border-gray-100'
                        }`}>
                          <th className="py-2.5 px-3">Période</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Motif</th>
                          <th className="py-2.5 px-3 text-center">Statut</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y text-xs ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
                        {doctorUnavailabilities.length === 0 ? (
                          <tr>
                            <td colSpan="5" className={`text-center py-6 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              Aucun blocage répertorié pour ce médecin.
                            </td>
                          </tr>
                        ) : (
                          doctorUnavailabilities.map((u) => (
                            <tr key={u.id}>
                              <td className={`py-3 px-3 font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                {u.is_full_day
                                  ? `Journée du ${u.start_datetime.substring(0, 10)}`
                                  : `Le ${u.start_datetime.substring(0, 10)} (${u.start_datetime.substring(11, 16)} à ${u.end_datetime.substring(11, 16)})`}
                              </td>
                              <td className="py-3 px-3 text-amber-700 font-medium">
                                {u.type}
                              </td>
                              <td className={`py-3 px-3 ${darkMode ? 'text-gray-300' : ''}`}>{u.reason || "Non précisé"}</td>
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
              <div className={`p-12 rounded-2xl border text-center text-xs ${
                darkMode 
                  ? 'bg-[#1E293B] border-gray-700 text-gray-400' 
                  : 'bg-white border-gray-100 text-gray-400'
              }`}>
                Veuillez sélectionner un médecin dans la liste de gauche pour afficher son
                planning et ses indisponibilités.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* ONGLET 3: CRÉER UN RENDEZ-VOUS & ESPACE GUICHET DÉDIÉ */}
      {/* ================================================================ */}
      {activeTab === "create_appointment" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`lg:col-span-2 p-6 rounded-2xl shadow-sm border space-y-6 ${
            darkMode 
              ? 'bg-[#1E293B] border-gray-700' 
              : 'bg-white border-gray-100'
          }`}>
            <h2 className={`text-base font-bold ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>
              Nouveau Rendez-vous Guichet / Téléphone
            </h2>

            <div className={`flex border-b pb-3 gap-4 text-xs font-bold ${darkMode ? 'border-gray-700' : ''}`}>
              <span
                className={
                  bookingStep === 1
                    ? "text-blue-600 border-b-2 border-blue-600 pb-1"
                    : darkMode ? "text-gray-500" : "text-gray-400"
                }
              >
                1. Patient
              </span>
              <span
                className={
                  bookingStep === 2
                    ? "text-blue-600 border-b-2 border-blue-600 pb-1"
                    : darkMode ? "text-gray-500" : "text-gray-400"
                }
              >
                2. Spécialité & Médecin
              </span>
              <span
                className={
                  bookingStep === 3
                    ? "text-blue-600 border-b-2 border-blue-600 pb-1"
                    : darkMode ? "text-gray-500" : "text-gray-400"
                }
              >
                3. Date & Créneau
              </span>
              <span
                className={
                  bookingStep === 4
                    ? "text-blue-600 border-b-2 border-blue-600 pb-1"
                    : darkMode ? "text-gray-500" : "text-gray-400"
                }
              >
                4. Paiement & Assurance
              </span>
            </div>

            {/* ÉTAPE 1: PATIENT */}
            {bookingStep === 1 && (
              <div className="space-y-4">
                <div className={`flex gap-4 p-2 rounded-xl border text-xs font-bold ${
                  darkMode 
                    ? 'bg-[#111827] border-gray-700' 
                    : 'bg-gray-50 border-gray-100'
                }`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="patientMode"
                      value="existing"
                      checked={patientSelectionMode === "existing"}
                      onChange={() => setPatientSelectionMode("existing")}
                    />
                    Patient existant
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="patientMode"
                      value="new"
                      checked={patientSelectionMode === "new"}
                      onChange={() => setPatientSelectionMode("new")}
                    />
                    Nouveau patient
                  </label>
                </div>

                {patientSelectionMode === "existing" ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <label className={`block text-[11px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Rechercher un patient
                      </label>
                      <input
                        type="text"
                        placeholder="Tapez le nom, prénom ou téléphone..."
                        value={patientSearchTerm}
                        onChange={(e) => {
                          setPatientSearchTerm(e.target.value);
                          setSelectedPatientId("");
                        }}
                        className={`w-full px-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
                          darkMode 
                            ? 'bg-[#111827] border-gray-600 text-gray-200' 
                            : 'bg-gray-50'
                        }`}
                      />

                      {!selectedPatientId && patientSearchTerm.length >= 2 && (
                        <>
                          {filteredPatients.length > 0 ? (
                            <div className={`absolute z-10 w-full mt-1 border rounded-xl shadow-lg max-h-48 overflow-y-auto ${
                              darkMode 
                                ? 'bg-[#1E293B] border-gray-700' 
                                : 'bg-white border-gray-200'
                            }`}>
                              {filteredPatients.map((p) => (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    setSelectedPatientId(String(p.id));
                                    setPatientSearchTerm(`${p.nom} ${p.prenom} (${p.telephone || 'Sans tél.'})`);
                                    setFoundPatient(p);
                                  }}
                                  className={`px-3 py-2 cursor-pointer text-xs flex justify-between items-center border-b last:border-0 ${
                                    darkMode 
                                      ? 'hover:bg-[#111827] border-gray-700' 
                                      : 'hover:bg-blue-50 border-gray-50'
                                  }`}
                                >
                                  <span className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                    {p.nom} {p.prenom}
                                  </span>
                                  <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {p.telephone || 'Sans tél.'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className={`absolute z-10 w-full mt-1 border rounded-xl shadow-lg p-3 text-xs text-center ${
                              darkMode 
                                ? 'bg-[#1E293B] border-gray-700 text-gray-400' 
                                : 'bg-white border-gray-200 text-gray-400'
                            }`}>
                              Aucun patient trouvé. Essayez un autre terme ou passez en "Nouveau patient".
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {selectedPatientId && foundPatient && (
                      <div className={`p-3 border rounded-xl flex justify-between items-center ${
                        darkMode 
                          ? 'bg-blue-900/20 border-blue-800' 
                          : 'bg-blue-50 border-blue-200'
                      }`}>
                        <div>
                          <p className={`text-xs font-bold ${darkMode ? 'text-blue-300' : 'text-blue-900'}`}>
                            {foundPatient.nom} {foundPatient.prenom}
                          </p>
                          <p className={`text-[10px] ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                            {foundPatient.telephone || 'Sans téléphone'} • {foundPatient.email || 'Sans email'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedPatientId("");
                            setPatientSearchTerm("");
                            setFoundPatient(null);
                          }}
                          className="text-xs text-red-500 hover:text-red-700 font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-[11px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Nom *
                      </label>
                      <input
                        type="text"
                        placeholder="Nom du patient"
                        value={patientFormData.nom}
                        onChange={(e) =>
                          setPatientFormData({ ...patientFormData, nom: e.target.value })
                        }
                        className={`w-full px-3 py-2 text-xs border rounded-xl ${
                          darkMode 
                            ? 'bg-[#111827] border-gray-600 text-gray-200' 
                            : 'bg-gray-50'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Prénom *
                      </label>
                      <input
                        type="text"
                        placeholder="Prénom du patient"
                        value={patientFormData.prenom}
                        onChange={(e) =>
                          setPatientFormData({ ...patientFormData, prenom: e.target.value })
                        }
                        className={`w-full px-3 py-2 text-xs border rounded-xl ${
                          darkMode 
                            ? 'bg-[#111827] border-gray-600 text-gray-200' 
                            : 'bg-gray-50'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Numéro Téléphone *
                      </label>
                      <input
                        type="text"
                        placeholder="ex: +229 97000000"
                        value={patientFormData.telephone}
                        onChange={(e) =>
                          setPatientFormData({ ...patientFormData, telephone: e.target.value })
                        }
                        className={`w-full px-3 py-2 text-xs border rounded-xl ${
                          darkMode 
                            ? 'bg-[#111827] border-gray-600 text-gray-200' 
                            : 'bg-gray-50'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        E-mail (Facultatif)
                      </label>
                      <input
                        type="email"
                        placeholder="patient@example.com"
                        value={patientFormData.email}
                        onChange={(e) =>
                          setPatientFormData({ ...patientFormData, email: e.target.value })
                        }
                        className={`w-full px-3 py-2 text-xs border rounded-xl ${
                          darkMode 
                            ? 'bg-[#111827] border-gray-600 text-gray-200' 
                            : 'bg-gray-50'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Sexe
                      </label>
                      <select
                        value={patientFormData.sexe}
                        onChange={(e) =>
                          setPatientFormData({ ...patientFormData, sexe: e.target.value })
                        }
                        className={`w-full px-3 py-2 text-xs border rounded-xl ${
                          darkMode 
                            ? 'bg-[#111827] border-gray-600 text-gray-200' 
                            : 'bg-gray-50'
                        }`}
                      >
                        <option value="M">Masculin</option>
                        <option value="F">Féminin</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-[11px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Âge
                      </label>
                      <input
                        type="number"
                        placeholder="ex: 35"
                        value={patientFormData.age}
                        onChange={(e) =>
                          setPatientFormData({ ...patientFormData, age: e.target.value })
                        }
                        className={`w-full px-3 py-2 text-xs border rounded-xl ${
                          darkMode 
                            ? 'bg-[#111827] border-gray-600 text-gray-200' 
                            : 'bg-gray-50'
                        }`}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-3">
                  <button
                    onClick={() => {
                      if (patientSelectionMode === "existing") {
                        if (!selectedPatientId) {
                          return alert("Veuillez choisir un patient dans la liste.");
                        }
                        const patientObj = patientsList.find(
                          (p) => String(p.id) === String(selectedPatientId)
                        );
                        if (patientObj) {
                          setFoundPatient(patientObj);
                          setBookingStep(2);
                        }
                      } else {
                        if (!patientFormData.nom || !patientFormData.prenom || !patientFormData.telephone) {
                          return alert("Veuillez renseigner au moins le nom, prénom et téléphone.");
                        }
                        handleSelectOrRegisterPatient();
                      }
                    }}
                    className="bg-[#0D1B3D] text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-blue-900 transition"
                  >
                    Valider le patient & Continuer
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 2: SPÉCIALITÉ & MÉDECIN */}
            {bookingStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className={`block text-[11px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Spécialité médicale *
                  </label>
                  <select
                    value={selectedSpecialityId}
                    onChange={(e) => {
                      setSelectedSpecialityId(e.target.value);
                      setCounterDoctorId("");
                      setCounterSlots([]);
                    }}
                    className={`w-full px-3 py-2 text-xs border rounded-xl ${
                      darkMode 
                        ? 'bg-[#111827] border-gray-600 text-gray-200' 
                        : 'bg-gray-50'
                    }`}
                  >
                    <option value="">-- Choisissez une spécialité --</option>
                    {specialities.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nom}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSpecialityId && (
                  <div>
                    <label className={`block text-[11px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Médecin *
                    </label>
                    <select
                      value={counterDoctorId}
                      onChange={(e) => {
                        setCounterDoctorId(e.target.value);
                        setCounterSlots([]);
                        setCounterDate("");
                        setCounterSelectedSlot(null);
                      }}
                      className={`w-full px-3 py-2 text-xs border rounded-xl ${
                        darkMode 
                          ? 'bg-[#111827] border-gray-600 text-gray-200' 
                          : 'bg-gray-50'
                      }`}
                    >
                      <option value="">-- Choisissez un médecin --</option>
                      {doctors
                        .filter((d) => String(d.speciality_id) === String(selectedSpecialityId) && d.status === 'actif')
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            Dr. {d.nom} {d.prenom}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-between pt-3">
                  <button
                    onClick={() => setBookingStep(1)}
                    className={`text-xs font-bold ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    ← Retour
                  </button>
                  <button
                    disabled={!counterDoctorId}
                    onClick={() => {
                      if (counterDoctorId) {
                        setBookingStep(3);
                      }
                    }}
                    className="bg-[#0D1B3D] disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-blue-900 transition"
                  >
                    Continuer vers les créneaux
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 3: DATE & CRÉNEAU */}
            {bookingStep === 3 && (
              <div className="space-y-4">
                <div>
                  <label className={`block text-[11px] font-bold mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Date de consultation disponible
                  </label>

                  {availableDates.length === 0 ? (
                    <div className={`text-center py-6 text-xs rounded-xl border border-dashed ${
                      darkMode 
                        ? 'text-gray-500 bg-[#111827] border-gray-700' 
                        : 'text-gray-400 bg-gray-50 border-gray-200'
                    }`}>
                      Aucune date disponible pour ce médecin.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {availableDates.map((date) => (
                        <button
                          key={date}
                          type="button"
                          onClick={() => {
                            setCounterDate(date);
                            setCounterSelectedSlot(null);
                            if (counterDoctorId && date) {
                              loadSlotsForDate(counterDoctorId, date);
                            }
                          }}
                          className={`p-2 text-xs rounded-xl border font-medium text-center transition ${
                            counterDate === date && !counterSelectedSlot
                              ? "bg-blue-600 text-white border-blue-600"
                              : darkMode
                                ? "bg-[#111827] text-gray-300 border-gray-600 hover:border-blue-400 hover:bg-blue-900/30"
                                : "bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                          }`}
                        >
                          {new Date(date).toLocaleDateString("fr-FR", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {counterDate && (
                  <div>
                    <label className={`block text-[11px] font-bold mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Créneaux disponibles
                    </label>
                    {counterSlots.length === 0 ? (
                      <div className={`text-center py-6 text-xs rounded-xl border border-dashed ${
                        darkMode 
                          ? 'text-gray-500 bg-[#111827] border-gray-700' 
                          : 'text-gray-400 bg-gray-50 border-gray-200'
                      }`}>
                        Aucun créneau disponible pour cette date.
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {counterSlots.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setCounterSelectedSlot(slot)}
                            className={`p-2 text-xs rounded-xl border font-bold text-center transition ${
                              counterSelectedSlot?.id === slot.id
                                ? "bg-blue-600 text-white border-blue-600"
                                : darkMode
                                  ? "bg-emerald-900/20 text-emerald-300 border-emerald-800 hover:bg-emerald-900/30"
                                  : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                            }`}
                          >
                            {slot.start_time.substring(0, 5)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between pt-3">
                  <button
                    onClick={() => setBookingStep(2)}
                    className={`text-xs font-bold ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    ← Retour
                  </button>
                  <button
                    disabled={!counterSelectedSlot}
                    onClick={() => setBookingStep(4)}
                    className="bg-[#0D1B3D] disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-blue-900 transition"
                  >
                    Continuer vers le Paiement
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 4: PAIEMENT & ASSURANCE */}
            {bookingStep === 4 && (
              <form onSubmit={handleAssistedBookingSubmit} className="space-y-4">
                <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                  darkMode 
                    ? 'bg-[#111827] border-gray-700' 
                    : 'bg-gray-50 border-gray-100'
                }`}>
                  <p className={`font-bold ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>
                    {foundPatient?.nom} {foundPatient?.prenom}
                  </p>
                  <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Dr. {doctors.find((d) => String(d.id) === String(counterDoctorId))?.nom} •{" "}
                    {counterDate} à {counterSelectedSlot?.start_time?.substring(0, 5)}
                  </p>
                </div>

                <div className={`p-3 rounded-xl border ${
                  darkMode 
                    ? 'bg-blue-900/20 border-blue-800' 
                    : 'bg-blue-50 border-blue-100'
                }`}>
                  <label className={`flex items-center gap-2 text-xs font-bold cursor-pointer ${darkMode ? 'text-blue-300' : 'text-blue-900'}`}>
                    <input
                      type="checkbox"
                      checked={counterHasInsurance}
                      onChange={(e) => setCounterHasInsurance(e.target.checked)}
                    />
                    Le patient possède une assurance
                  </label>
                </div>

                {counterHasInsurance && (
                  <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border ${
                    darkMode 
                      ? 'bg-[#111827] border-gray-700' 
                      : 'bg-gray-50 border-gray-100'
                  }`}>
                    <div>
                      <label className={`block text-[11px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Nom de l'assurance
                      </label>
                      <input
                        type="text"
                        placeholder="ex: NSIA, SANLAM"
                        value={counterInsuranceName}
                        onChange={(e) => setCounterInsuranceName(e.target.value)}
                        className={`w-full px-3 py-2 text-xs border rounded-xl ${
                          darkMode 
                            ? 'bg-[#1E293B] border-gray-600 text-gray-200' 
                            : 'bg-white'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        N° Police d'assurance
                      </label>
                      <input
                        type="text"
                        placeholder="ex: POL-88902"
                        value={counterInsurancePolicy}
                        onChange={(e) => setCounterInsurancePolicy(e.target.value)}
                        className={`w-full px-3 py-2 text-xs border rounded-xl ${
                          darkMode 
                            ? 'bg-[#1E293B] border-gray-600 text-gray-200' 
                            : 'bg-white'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Taux de couverture (%)
                      </label>
                      <input
                        type="number"
                        placeholder="ex: 80"
                        value={counterInsuranceRate}
                        onChange={(e) => setCounterInsuranceRate(e.target.value)}
                        className={`w-full px-3 py-2 text-xs border rounded-xl ${
                          darkMode 
                            ? 'bg-[#1E293B] border-gray-600 text-gray-200' 
                            : 'bg-white'
                        }`}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setBookingStep(3)}
                    className={`text-xs font-bold ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    ← Retour
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingBooking}
                    className="bg-[#0D1B3D] hover:bg-blue-900 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmittingBooking ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Traitement...
                      </>
                    ) : (
                      "Payer et Confirmer le RDV"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ESPACE DÉDIÉ : GESTION DES RENDEZ-VOUS DU GUICHET */}
          <div className={`p-5 rounded-2xl shadow-sm border space-y-4 ${
            darkMode 
              ? 'bg-[#1E293B] border-gray-700' 
              : 'bg-white border-gray-100'
          }`}>
            <div>
              <h3 className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>
                Rendez-vous Créés au Guichet
              </h3>
              <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Gérer, modifier ou annuler les RDVs créés par vous
              </p>
            </div>

            <div className={`divide-y max-h-[500px] overflow-y-auto space-y-2 ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
              {secretaryHistory.length === 0 ? (
                <p className={`text-xs py-4 text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Aucune réservation au guichet répertoriée.
                </p>
              ) : (
                secretaryHistory.map((item) => (
                  <div key={item.id} className="pt-3 pb-2 text-xs space-y-1.5">
                    <div className={`flex justify-between items-start font-bold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      <span>
                        {item.patient?.nom} {item.patient?.prenom}
                      </span>
                      <span className="text-emerald-600 text-[11px]">
                        {item.amount_to_pay} XOF
                      </span>
                    </div>

                    <p className={`text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Dr. {item.slot?.doctor?.nom} — {item.slot?.date_consultation} ({item.slot?.start_time?.substring(0, 5)})
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        {item.status}
                      </span>

                      {item.status !== "ANNULE_HOPITAL" && item.status !== "TERMINE" && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                              darkMode 
                                ? 'bg-indigo-900/30 text-indigo-300 hover:bg-indigo-900/50' 
                                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                            }`}
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleCancelAssistedAppointment(item.id)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                              darkMode 
                                ? 'bg-red-900/30 text-red-300 hover:bg-red-900/50' 
                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                            }`}
                          >
                            Annuler
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MODALE DE MODIFICATION ASSISTÉE D'UN RDV DU GUICHET */}
      {/* ================================================================ */}
      {editingAppointment && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 ${
            darkMode ? 'bg-[#1E293B]' : 'bg-white'
          }`}>
            <h3 className={`text-base font-bold ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>
              Modifier le RDV #{editingAppointment.id}
            </h3>

            <div className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              <p>
                <strong>Patient :</strong> {editingAppointment.patient?.nom}{" "}
                {editingAppointment.patient?.prenom}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className={`block text-[11px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Changer la Date
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs border rounded-xl ${
                    darkMode 
                      ? 'bg-[#111827] border-gray-600 text-gray-200' 
                      : 'bg-gray-50'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-bold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Nouveaux Créneaux
                </label>
                <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto">
                  {editSlots.length === 0 ? (
                    <p className={`text-xs col-span-full ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Aucun créneau disponible.
                    </p>
                  ) : (
                    editSlots.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setEditSelectedSlot(s)}
                        className={`p-1.5 text-xs rounded-xl border font-bold text-center ${
                          editSelectedSlot?.id === s.id
                            ? "bg-blue-600 text-white"
                            : darkMode
                              ? "bg-emerald-900/20 text-emerald-300 border-emerald-800"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        {s.start_time.substring(0, 5)}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setEditingAppointment(null)}
                className={`px-4 py-2 text-xs font-bold ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Fermer
              </button>
              <button
                disabled={!editSelectedSlot}
                onClick={handleUpdateAssistedAppointment}
                className="px-4 py-2 text-xs font-bold bg-[#0D1B3D] disabled:opacity-50 text-white rounded-xl hover:bg-blue-900 transition"
              >
                Enregistrer le changement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* MODALE TRAITEMENT ASSURANCE */}
      {/* ================================================================ */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 ${
            darkMode ? 'bg-[#1E293B]' : 'bg-white'
          }`}>
            <h3 className={`text-base font-bold ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>
              Traitement Assurance — RDV #{selectedAppointment.id}
            </h3>

            <div className={`p-3 border rounded-xl space-y-2 ${
              darkMode 
                ? 'bg-[#111827] border-gray-700' 
                : 'bg-gray-50 border-gray-100'
            }`}>
              <div className="text-xs">
                <span className={`font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Assurance : </span>
                <span className={`font-bold ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>
                  {selectedAppointment.insurance_name || "N/A"}
                </span>
                {selectedAppointment.insurance_policy_number && (
                  <span className={`block text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    N° Police: {selectedAppointment.insurance_policy_number}
                  </span>
                )}
              </div>

              {selectedAppointment.insurance_document_path ? (
                <a
                  href={
                    selectedAppointment.insurance_document_path.startsWith("http")
                      ? selectedAppointment.insurance_document_path
                      : `http://localhost:8000/${selectedAppointment.insurance_document_path}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-2 rounded-lg w-full justify-center transition border border-blue-100"
                >
                  Consulter la pièce jointe
                </a>
              ) : (
                <p className={`text-xs ${darkMode ? 'text-amber-400' : 'text-amber-600'} italic`}>Aucun document téléversé.</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsRejecting(false)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${
                  !isRejecting
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : darkMode
                      ? "bg-[#111827] text-gray-400 border-gray-700"
                      : "bg-gray-50 text-gray-600"
                }`}
              >
                Accepter
              </button>
              <button
                onClick={() => setIsRejecting(true)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${
                  isRejecting
                    ? "bg-red-50 text-red-700 border-red-300"
                    : darkMode
                      ? "bg-[#111827] text-gray-400 border-gray-700"
                      : "bg-gray-50 text-gray-600"
                }`}
              >
                Refuser
              </button>
            </div>

            {!isRejecting ? (
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Taux de couverture (%)
                </label>
                <input
                  type="number"
                  placeholder="ex: 80"
                  value={coverageRate}
                  onChange={(e) => setCoverageRate(e.target.value)}
                  className={`w-full px-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none ${
                    darkMode 
                      ? 'bg-[#111827] border-gray-600 text-gray-200' 
                      : 'bg-white'
                  }`}
                />
              </div>
            ) : (
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Motif du refus
                </label>
                <input
                  type="text"
                  placeholder="ex: Document illisible"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className={`w-full px-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-red-500 outline-none ${
                    darkMode 
                      ? 'bg-[#111827] border-gray-600 text-gray-200' 
                      : 'bg-white'
                  }`}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setSelectedAppointment(null)}
                className={`px-4 py-2 text-xs font-bold ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
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