import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  CreditCard,
  Filter,
  Ban,
  Trash2,
  Eye,
  EyeOff,
  X,
  Edit3,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { apiFetch } from './api'; // 🔥 AJOUT

const ITEMS_PER_PAGE = 5;

export default function PatientAppointmentsList({ keycloakUuid }) { // 🔥 SUPPRESSION DE authToken
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Notification Toast state
  const [toast, setToast] = useState({
    show: false,
    type: "success",
    title: "",
    message: "",
  });

  // Confirmation Modal State (Cancel appointment)
  const [cancelModal, setCancelModal] = useState({ open: false, apptId: null });

  // Pagination & Filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");

  const [hiddenApptIds, setHiddenApptIds] = useState(() => {
    const saved = localStorage.getItem("hidden_expired_appts");
    return saved ? JSON.parse(saved) : [];
  });

  const [showHiddenExpired, setShowHiddenExpired] = useState(false);

  // Modale de modification
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [catalog, setCatalog] = useState([]);

  const [editForm, setEditForm] = useState({
    specialityId: "",
    doctorId: "",
    date: "",
    slotId: "",
    hasInsurance: false,
    insuranceName: "",
    insurancePolicyNumber: "",
    insuranceDocument: null,
  });

  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);

  // État de l'action en cours
  const [actionLoading, setActionLoading] = useState(null);

  // Auto-dismiss Toast après 4 secondes
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const showToast = (type, title, message) => {
    setToast({ show: true, type, title, message });
  };

  const getApptId = (appt) => appt?.id ?? appt?.appointment_id;

  // 🔥 Remplacer getHeaders par apiFetch
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/patients/${keycloakUuid}/appointments`);
      if (data.success) {
        setAppointments(data.data || []);
      } else {
        showToast(
          "error",
          "Erreur de chargement",
          data.message || "Impossible de récupérer vos rendez-vous."
        );
      }
    } catch (err) {
      showToast(
        "error",
        "Erreur réseau",
        "Impossible de se connecter au serveur."
      );
    } finally {
      setLoading(false);
    }
  }, [keycloakUuid]);

  const fetchCatalog = useCallback(async () => {
    try {
      const data = await apiFetch('/catalog');
      if (data.success) setCatalog(data.data || []);
    } catch (err) {
      console.error("Erreur chargement catalogue:", err);
    }
  }, []);

  useEffect(() => {
    if (keycloakUuid) {
      fetchAppointments();
      fetchCatalog();
    }
  }, [keycloakUuid, fetchAppointments, fetchCatalog]);

  const toggleHideExpiredAppointment = (apptId) => {
    if (!apptId) return;
    const updated = hiddenApptIds.includes(apptId)
      ? hiddenApptIds.filter((id) => id !== apptId)
      : [...hiddenApptIds, apptId];
    setHiddenApptIds(updated);
    localStorage.setItem("hidden_expired_appts", JSON.stringify(updated));
  };

  const isAppointmentExpired = (appt) => {
    if (["EXPIRE", "ANNULE_PATIENT", "ANNULE_HOPITAL"].includes(appt.status))
      return false;
    if (appt.status !== "EN_ATTENTE_PAIEMENT") return false;

    const now = new Date();
    const createdAt = new Date(appt.created_at);
    const is24hPassed = now - createdAt > 24 * 60 * 60 * 1000;

    let isSlotPassed = false;
    if (appt.slot) {
      const slotDateTime = new Date(
        `${appt.slot.date_consultation}T${appt.slot.start_time}`
      );
      isSlotPassed = slotDateTime < now;
    }

    return is24hPassed || isSlotPassed;
  };

  const getEffectiveStatus = (appt) =>
    isAppointmentExpired(appt) ? "EXPIRE" : appt.status;

  // 🔥 handlePayment avec apiFetch
  const handlePayment = async (apptId) => {
    if (!apptId || actionLoading) return;

    setActionLoading({ id: apptId, type: "pay" });

    try {
      const data = await apiFetch('/payments/initiate', {
        method: "POST",
        body: JSON.stringify({ appointment_id: apptId }),
      });

      if (data.success && data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        showToast(
          "error",
          "Erreur de paiement",
          data.message || "Erreur lors de l'initiation du paiement."
        );
      }
    } catch (err) {
      showToast(
        "error",
        "Erreur réseau",
        "Problème de connexion lors du lancement du paiement."
      );
    } finally {
      setActionLoading(null);
    }
  };

  // 🔥 executeCancel avec apiFetch
  const executeCancel = async () => {
    const apptId = cancelModal.apptId;
    if (!apptId) return;

    setActionLoading({ id: apptId, type: "cancel" });
    try {
      const data = await apiFetch(`/appointments/${apptId}/cancel`, {
        method: "POST",
        body: JSON.stringify({
          reason: "Annulé par le patient via le portail web",
        }),
      });

      if (data.success) {
        showToast(
          "success",
          "Rendez-vous annulé",
          data.message || "Votre rendez-vous a été annulé."
        );
        fetchAppointments();
      } else {
        showToast(
          "error",
          "Erreur d'annulation",
          data.message || "Impossible d'annuler ce rendez-vous."
        );
      }
    } catch (err) {
      showToast(
        "error",
        "Erreur réseau",
        "Problème lors de la demande d'annulation."
      );
    } finally {
      setActionLoading(null);
      setCancelModal({ open: false, apptId: null });
    }
  };

  // 🔥 fetchSlotsForDoctorAndDate avec apiFetch
  const fetchSlotsForDoctorAndDate = async (doctorId, date) => {
    if (!doctorId || !date) return;
    try {
      const data = await apiFetch(`/doctors/${doctorId}/slots?date=${date}`);
      setAvailableSlots(data.success ? data.data || [] : []);
    } catch (err) {
      setAvailableSlots([]);
    }
  };

  const openEditModal = (appt) => {
    setSelectedAppt(appt);
    const doctor = appt.slot?.doctor;
    const specialityId = doctor?.speciality_id || "";

    const selectedSpec = catalog.find((s) => s.id === Number(specialityId));
    setAvailableDoctors(selectedSpec ? selectedSpec.doctors : []);

    setEditForm({
      specialityId,
      doctorId: doctor?.id || "",
      date: appt.slot?.date_consultation || "",
      slotId: appt.slot_id || "",
      hasInsurance: appt.has_insurance || false,
      insuranceName: appt.insurance_name || "",
      insurancePolicyNumber: appt.insurance_policy_number || "",
      insuranceDocument: null,
    });

    if (doctor?.id && appt.slot?.date_consultation) {
      fetchSlotsForDoctorAndDate(doctor.id, appt.slot.date_consultation);
    }

    setEditModalOpen(true);
  };

  const handleSpecialityChange = (specId) => {
    const selectedSpec = catalog.find((s) => s.id === Number(specId));
    setAvailableDoctors(selectedSpec ? selectedSpec.doctors : []);

    setEditForm((prev) => ({
      ...prev,
      specialityId: specId,
      doctorId: "",
      date: "",
      slotId: "",
    }));
    setAvailableSlots([]);
  };

  const handleDoctorChange = (docId) => {
    setEditForm((prev) => ({ ...prev, doctorId: docId, date: "", slotId: "" }));
    setAvailableSlots([]);
  };

  const handleDateChange = (date) => {
    setEditForm((prev) => ({ ...prev, date, slotId: "" }));
    fetchSlotsForDoctorAndDate(editForm.doctorId, date);
  };

  // 🔥 handleSaveEdit avec apiFetch
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const apptId = getApptId(selectedAppt);
    if (!editForm.slotId || !apptId || actionLoading) {
      if (!editForm.slotId)
        showToast(
          "error",
          "Champ requis",
          "Veuillez sélectionner un créneau horaire."
        );
      return;
    }

    setActionLoading({ id: apptId, type: "save_edit" });
    try {
      const formData = new FormData();
      formData.append("_method", "PUT");
      formData.append("slot_id", editForm.slotId);
      formData.append("has_insurance", editForm.hasInsurance ? "1" : "0");

      if (editForm.hasInsurance) {
        formData.append("insurance_name", editForm.insuranceName);
        formData.append(
          "insurance_policy_number",
          editForm.insurancePolicyNumber
        );
        if (editForm.insuranceDocument) {
          formData.append("insurance_document", editForm.insuranceDocument);
        }
      }

      const data = await apiFetch(`/appointments/${apptId}`, {
        method: "POST",
        body: formData,
      });

      if (data.success) {
        showToast(
          "success",
          "Mise à jour réussie",
          "Votre rendez-vous a été modifié avec succès !"
        );
        setEditModalOpen(false);
        fetchAppointments();
      } else {
        showToast(
          "error",
          "Erreur de modification",
          data.message || "Impossible de mettre à jour le rendez-vous."
        );
      }
    } catch (err) {
      showToast(
        "error",
        "Erreur réseau",
        "Problème de connexion lors de la modification."
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Filtrage des rendez-vous
  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((appt) => {
        const apptId = getApptId(appt);
        return showHiddenExpired ? true : !hiddenApptIds.includes(apptId);
      })
      .filter((appt) => {
        const effectiveStatus = getEffectiveStatus(appt);
        const matchesStatus =
          statusFilter === "ALL" || effectiveStatus === statusFilter;
        const matchesDate =
          !dateFilter || appt.slot?.date_consultation === dateFilter;
        return matchesStatus && matchesDate;
      });
  }, [
    appointments,
    showHiddenExpired,
    hiddenApptIds,
    statusFilter,
    dateFilter,
  ]);

  // Pagination calculée
  const totalPages =
    Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE) || 1;
  const paginatedAppointments = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAppointments.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAppointments, currentPage]);

  const resetFilters = () => {
    setStatusFilter("ALL");
    setDateFilter("");
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 font-medium flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span>Chargement de vos rendez-vous...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 relative">
      {/* SYSTEME TOAST NOTIFICATION */}
      {toast.show && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-bounce-in">
          <div
            className={`p-4 rounded-2xl shadow-xl border flex items-start gap-3 bg-white ${
              toast.type === "success"
                ? "border-emerald-200"
                : "border-rose-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h4
                className={`text-xs font-bold ${
                  toast.type === "success"
                    ? "text-emerald-900"
                    : "text-rose-900"
                }`}
              >
                {toast.title}
              </h4>
              <p className="text-xs text-gray-600 mt-0.5">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast((prev) => ({ ...prev, show: false }))}
              className="text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* EN-TÊTE + BARRE DE FILTRES */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#0D1B3D]">
              Vos rendez-vous
            </h2>
            <p className="text-xs text-gray-500">
              Gérez, modifiez ou réglez vos consultations médicales
            </p>
          </div>

          <button
            onClick={() => {
              setShowHiddenExpired(!showHiddenExpired);
              setCurrentPage(1);
            }}
            className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 border text-gray-700 px-3 py-1.5 rounded-xl text-xs font-medium transition"
          >
            {showHiddenExpired ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            {showHiddenExpired
              ? "Masquer les archivés"
              : "Afficher les archivés"}
          </button>
        </div>

        {/* RECHERCHE ET FILTRES */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 bg-gray-50 border px-3 py-1.5 rounded-xl text-xs">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent outline-none font-medium text-gray-700"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="CONFIRME">Confirmés</option>
                <option value="EN_ATTENTE_PAIEMENT">Attente Paiement</option>
                <option value="EN_ATTENTE_VALIDATION">Attente Assurance</option>
                <option value="ANNULE_PATIENT">Annulés</option>
                <option value="EXPIRE">Expirés</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-gray-50 border px-3 py-1.5 rounded-xl text-xs">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent outline-none font-medium text-gray-700"
              />
            </div>

            {(statusFilter !== "ALL" || dateFilter !== "") && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1"
              >
                <RotateCcw className="w-3 h-3" />
                Réinitialiser
              </button>
            )}
          </div>

          <div className="text-xs text-gray-500 font-medium">
            <strong>{filteredAppointments.length}</strong> rendez-vous trouvé(s)
          </div>
        </div>
      </div>

      {/* LISTE DES RENDEZ-VOUS PAGINÉS */}
      {paginatedAppointments.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border text-center text-gray-500">
          <Calendar className="w-10 h-10 mx-auto text-gray-400 mb-2" />
          <p className="font-medium text-sm">Aucun rendez-vous trouvé.</p>
          {(statusFilter !== "ALL" || dateFilter !== "") && (
            <button
              onClick={resetFilters}
              className="text-xs text-indigo-600 underline font-medium mt-2 inline-block"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {paginatedAppointments.map((appt, index) => {
            const currentId = getApptId(appt);
            const doctor = appt.slot?.doctor;
            const effectiveStatus = getEffectiveStatus(appt);
            const isExpired = effectiveStatus === "EXPIRE";
            const isCanceled =
              effectiveStatus === "ANNULE_PATIENT" ||
              effectiveStatus === "ANNULE_HOPITAL";
            const isPendingPayment = effectiveStatus === "EN_ATTENTE_PAIEMENT";
            const isHidden = currentId
              ? hiddenApptIds.includes(currentId)
              : false;
            const hasInsurance =
              appt.has_insurance &&
              appt.insurance_name &&
              appt.insurance_name !== "0";

            const isCurrentApptAction = Boolean(
              actionLoading &&
              currentId != null &&
              actionLoading.id != null &&
              String(actionLoading.id) === String(currentId)
            );

            const isPayingThis =
              isCurrentApptAction && actionLoading.type === "pay";
            const isCancelingThis =
              isCurrentApptAction && actionLoading.type === "cancel";

            const absoluteIndex =
              (currentPage - 1) * ITEMS_PER_PAGE + index + 1;

            return (
              <div
                key={currentId || index}
                className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 ${isHidden ? "opacity-60 bg-gray-50" : ""}`}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-md">
                        N° {absoluteIndex}
                      </span>
                      <span className="text-xs text-indigo-600 font-bold uppercase">
                        {doctor?.speciality?.nom || "Consultation"}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900 text-base">
                      {doctor
                        ? `Dr. ${doctor.prenom} ${doctor.nom}`
                        : "Médecin non assigné"}
                    </h3>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      effectiveStatus === "CONFIRME"
                        ? "bg-emerald-100 text-emerald-800"
                        : effectiveStatus === "EN_ATTENTE_PAIEMENT"
                          ? "bg-amber-100 text-amber-800"
                          : effectiveStatus === "EN_ATTENTE_VALIDATION"
                            ? "bg-blue-100 text-blue-800"
                            : isCanceled
                              ? "bg-rose-100 text-rose-800"
                              : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {effectiveStatus.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl text-xs text-gray-600">
                  <div className="space-y-1.5">
                    <div>
                      <strong>Date soin :</strong>{" "}
                      {appt.slot?.date_consultation || "N/A"}
                    </div>
                    <div>
                      <strong>Créneau :</strong>{" "}
                      {appt.slot?.start_time
                        ? `${appt.slot.start_time.substring(0, 5)} - ${appt.slot.end_time?.substring(0, 5)}`
                        : "N/A"}
                    </div>
                    <div>
                      <strong>Montant à payer :</strong>{" "}
                      <span className="font-bold text-gray-900">
                        {appt.amount_to_pay} FCFA
                      </span>
                      {Number(appt.insurance_coverage_rate) > 0 &&
                        Number(appt.base_price) >
                          Number(appt.amount_to_pay) && (
                          <span className="ml-2 text-xs line-through text-gray-400">
                            {appt.base_price} FCFA
                          </span>
                        )}
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t md:border-t-0 md:border-l pt-2 md:pt-0 md:pl-3 border-gray-200">
                    <div>
                      <strong>Demande effectuée le :</strong>
                      <br />
                      {appt.created_at
                        ? new Date(appt.created_at).toLocaleString("fr-FR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "N/A"}
                    </div>
                    <div>
                      {hasInsurance ? (
                        <span className="inline-flex items-center gap-1">
                          Assurance : <strong>{appt.insurance_name}</strong>
                          {Number(appt.insurance_coverage_rate) > 0 ? (
                            <span className="text-emerald-600 font-semibold">
                              ({appt.insurance_coverage_rate}% pris en charge)
                            </span>
                          ) : appt.cancellation_reason ? (
                            <span className="text-rose-600 font-semibold">
                              (Refusée - 0%)
                            </span>
                          ) : (
                            <span className="text-amber-600 font-semibold">
                              (En cours de vérification)
                            </span>
                          )}
                        </span>
                      ) : (
                        "Sans assurance"
                      )}
                    </div>
                  </div>
                </div>
                {/* NOUVEAU BLOC : Message d'explication */}
                {appt.cancellation_reason && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-900 text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-rose-800">
                        Information concernant votre demande :
                      </span>
                      <p className="mt-0.5 text-rose-700">
                        {appt.cancellation_reason}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
                  {isPendingPayment && (
                    <button
                      onClick={() => handlePayment(currentId)}
                      className="px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md transition bg-[#2EAF5E] hover:bg-[#25934f] text-white"
                    >
                      {isPayingThis ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Paiement...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          <span>
                            Payer maintenant ({appt.amount_to_pay} FCFA)
                          </span>
                        </>
                      )}
                    </button>
                  )}

                  {!isExpired && !isCanceled && (
                    <>
                      <button
                        onClick={() => openEditModal(appt)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Modifier
                      </button>

                      <button
                        onClick={() =>
                          setCancelModal({ open: true, apptId: currentId })
                        }
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                      >
                        {isCancelingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Ban className="w-3.5 h-3.5" />
                        )}
                        {isCancelingThis ? "Annulation..." : "Annuler"}
                      </button>
                    </>
                  )}

                  {(isExpired || isCanceled) && (
                    <button
                      onClick={() => toggleHideExpiredAppointment(currentId)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-xl flex items-center gap-1 transition"
                    >
                      {isHidden ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      )}
                      {isHidden ? "Restaurer" : "Masquer"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FOOTER PAGINATION */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t bg-white p-4 rounded-2xl shadow-sm">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-50 border hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Précédent
          </button>

          <span className="text-xs text-gray-600 font-medium">
            Page <strong className="text-gray-900">{currentPage}</strong> sur{" "}
            <strong>{totalPages}</strong>
          </span>

          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-50 border hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Suivant
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MODALE DE CONFIRMATION D'ANNULATION */}
      {cancelModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-gray-900 text-base">
                Confirmer l'annulation
              </h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Êtes-vous absolument certain de vouloir annuler ce rendez-vous ?
              Cette action est irréversible et libérera le créneau horaire pour
              d'autres patients.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setCancelModal({ open: false, apptId: null })}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-xl transition"
              >
                Non, conserver
              </button>
              <button
                onClick={executeCancel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
              >
                {actionLoading?.type === "cancel" && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Oui, annuler le rendez-vous
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE DE MODIFICATION */}
      {editModalOpen && selectedAppt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                Modifier la demande de rendez-vous
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Spécialité
                  </label>
                  <select
                    value={editForm.specialityId}
                    onChange={(e) => handleSpecialityChange(e.target.value)}
                    disabled={selectedAppt.status === "CONFIRME"}
                    className="w-full border p-2.5 rounded-xl text-xs bg-white focus:border-indigo-500 outline-none"
                  >
                    <option value="">-- Spécialité --</option>
                    {catalog.map((spec) => (
                      <option key={spec.id} value={spec.id}>
                        {spec.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Médecin
                  </label>
                  <select
                    value={editForm.doctorId}
                    onChange={(e) => handleDoctorChange(e.target.value)}
                    disabled={!editForm.specialityId}
                    className="w-full border p-2.5 rounded-xl text-xs bg-white focus:border-indigo-500 outline-none"
                  >
                    <option value="">-- Médecin --</option>
                    {availableDoctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        Dr. {doc.prenom} {doc.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Date de consultation
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={editForm.date}
                    onChange={(e) => handleDateChange(e.target.value)}
                    disabled={!editForm.doctorId}
                    className="w-full border p-2.5 rounded-xl text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Créneau horaire
                  </label>
                  <select
                    value={editForm.slotId}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        slotId: e.target.value,
                      }))
                    }
                    disabled={!editForm.date}
                    className="w-full border p-2.5 rounded-xl text-xs bg-white focus:border-indigo-500 outline-none"
                  >
                    <option value="">-- Créneau --</option>
                    {availableSlots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.start_time.substring(0, 5)} -{" "}
                        {s.end_time.substring(0, 5)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t pt-3 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={editForm.hasInsurance}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        hasInsurance: e.target.checked,
                      }))
                    }
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Bénéficier d'une prise en charge Assurance
                </label>

                {editForm.hasInsurance && (
                  <div className="space-y-3 pl-2 border-l-2 border-indigo-200">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Nom de l'assurance
                      </label>
                      <input
                        type="text"
                        placeholder="ex: Gras Savoye, NSIA..."
                        value={editForm.insuranceName}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            insuranceName: e.target.value,
                          }))
                        }
                        className="w-full border p-2 rounded-xl text-xs outline-none focus:border-indigo-500"
                        required={editForm.hasInsurance}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        N° Assuré / Police
                      </label>
                      <input
                        type="text"
                        placeholder="N° de carte ou police"
                        value={editForm.insurancePolicyNumber}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            insurancePolicyNumber: e.target.value,
                          }))
                        }
                        className="w-full border p-2 rounded-xl text-xs outline-none focus:border-indigo-500"
                        required={editForm.hasInsurance}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Document justificatif (Optionnel si déjà fourni)
                      </label>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            insuranceDocument: e.target.files[0],
                          }))
                        }
                        className="w-full border p-2 rounded-xl text-xs bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
                >
                  {actionLoading?.id === getApptId(selectedAppt) &&
                    actionLoading?.type === "save_edit" && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                  {actionLoading?.id === getApptId(selectedAppt) &&
                  actionLoading?.type === "save_edit"
                    ? "Mise à jour..."
                    : "Enregistrer les modifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}