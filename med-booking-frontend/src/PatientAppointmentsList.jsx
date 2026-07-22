import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, AlertCircle, CheckCircle2, XCircle, RefreshCw, 
  User, Mail, FileText, CreditCard, ShieldCheck, ArrowRight, Save
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000/api';

export default function PatientAppointmentList({ keycloakUuid }) {
  const [activeTab, setActiveTab] = useState('appointments'); // 'appointments' | 'profile'
  const [appointments, setAppointments] = useState([]);
  const [userProfile, setUserProfile] = useState({ nom: '', prenom: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Modal Report de RDV
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (keycloakUuid) {
      fetchPatientData();
    }
  }, [keycloakUuid]);

  const fetchPatientData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/patients/${keycloakUuid}/appointments`);
      const data = await res.json();
      if (data.success) {
        setAppointments(data.data || []);
        if (data.user) {
          setUserProfile({
            nom: data.user.nom || '',
            prenom: data.user.prenom || '',
            email: data.user.email || ''
          });
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Impossible de charger vos données.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/patients/${keycloakUuid}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userProfile)
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Profil mis à jour avec succès !' });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (apptId) => {
    if (!window.confirm("Êtes-vous sûr de vouloir annuler ce rendez-vous ?")) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/appointments/${apptId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Annulation demandée par le patient' })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        fetchPatientData();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de l\'annulation.' });
    } finally {
      setActionLoading(false);
    }
  };

  const openRescheduleModal = async (appt) => {
    setSelectedAppt(appt);
    setSelectedDoctorId('');
    setSelectedDate('');
    setAvailableSlots([]);
    setSelectedSlotId('');
    
    try {
      const res = await fetch(`${API_BASE_URL}/catalog`);
      const data = await res.json();
      if (data.success) {
        setCatalog(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDoctorChange = (docId) => {
    setSelectedDoctorId(docId);
    setSelectedDate('');
    setAvailableSlots([]);
  };

  const handleDateChange = async (date) => {
    setSelectedDate(date);
    if (!selectedDoctorId || !date) return;

    try {
      const res = await fetch(`${API_BASE_URL}/doctors/${selectedDoctorId}/slots?date=${date}`);
      const data = await res.json();
      if (data.success) {
        setAvailableSlots(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!selectedSlotId) return;
    setActionLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/appointments/${selectedAppt.id}/reschedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: selectedSlotId })
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setSelectedAppt(null);
        fetchPatientData();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors du report du rendez-vous.' });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRME':
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/> Confirmé</span>;
      case 'EN_ATTENTE_PAIEMENT':
        return <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> Attente Paiement</span>;
      case 'EN_ATTENTE_VALIDATION':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5"/> Attente Assurance</span>;
      case 'ANNULE_PATIENT':
      case 'ANNULE_HOPITAL':
        return <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1"><XCircle className="w-3.5 h-3.5"/> Annulé</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs px-2.5 py-1 rounded-full font-medium">{status}</span>;
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Chargement de votre espace...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Barre de Navigation Onglets */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('appointments')}
          className={`py-3 px-6 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === 'appointments'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Mes Rendez-vous
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`py-3 px-6 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === 'profile'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Informations Personnelles
        </button>
      </div>

      {/* Messages d'alerte */}
      {message.text && (
        <div className={`p-4 rounded-xl flex items-center justify-between ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="font-bold">×</button>
        </div>
      )}

      {/* ONGLET 1 : RENDEZ-VOUS */}
      {activeTab === 'appointments' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800">Vos rendez-vous enregistrés</h2>

          {appointments.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border text-center text-gray-500 space-y-3">
              <Calendar className="w-12 h-12 mx-auto text-gray-400" />
              <p>Vous n'avez aucun rendez-vous pour le moment.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {appointments.map((appt) => {
                const doctor = appt.slot?.doctor;
                const isCancelled = ['ANNULE_PATIENT', 'ANNULE_HOPITAL'].includes(appt.status);

                return (
                  <div key={appt.id} className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs text-indigo-600 font-semibold tracking-wide uppercase">
                          {doctor?.speciality?.nom || 'Consultation'}
                        </span>
                        <h3 className="font-bold text-gray-900 text-lg">
                          Dr. {doctor?.prenom} {doctor?.nom}
                        </h3>
                      </div>
                      {getStatusBadge(appt.status)}
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-500" />
                        <span>{appt.slot?.date_consultation}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        <span>{appt.slot?.start_time?.substring(0, 5)} - {appt.slot?.end_time?.substring(0, 5)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-indigo-500" />
                        <span className="font-semibold text-gray-800">{appt.amount_to_pay} FCFA</span>
                        {appt.has_insurance && <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">Assurance</span>}
                      </div>
                    </div>

                    {!isCancelled && (
                      <div className="flex gap-2 pt-2 border-t">
                        <button
                          onClick={() => openRescheduleModal(appt)}
                          disabled={actionLoading}
                          className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition"
                        >
                          Déplacer / Reporter
                        </button>
                        <button
                          onClick={() => handleCancel(appt.id)}
                          disabled={actionLoading}
                          className="flex-1 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition"
                        >
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ONGLET 2 : PROFIL PATIENT */}
      {activeTab === 'profile' && (
        <div className="bg-white p-6 border rounded-2xl shadow-sm max-w-2xl space-y-6">
          <h2 className="text-xl font-bold text-gray-800">Mes Informations Personnelles</h2>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nom</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  required
                  value={userProfile.nom}
                  onChange={(e) => setUserProfile({ ...userProfile, nom: e.target.value })}
                  className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Prénom</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  required
                  value={userProfile.prenom}
                  onChange={(e) => setUserProfile({ ...userProfile, prenom: e.target.value })}
                  className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Adresse Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="email"
                  required
                  value={userProfile.email}
                  onChange={(e) => setUserProfile({ ...userProfile, email: e.target.value })}
                  className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition"
            >
              <Save className="w-4 h-4" />
              Sauvegarder les modifications
            </button>
          </form>
        </div>
      )}

      {/* MODAL MODIFICATION / REPORT DE CRÉNEAU */}
      {selectedAppt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Reporter votre rendez-vous</h3>
            
            {selectedAppt.status === 'CONFIRME' && (
              <p className="text-xs bg-amber-50 text-amber-800 p-2.5 rounded-lg">
                Votre RDV est payé. Vous ne pouvez pas modifier la spécialité, mais vous pouvez choisir un autre médecin ou créneau de cette spécialité.
              </p>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">1. Sélectionner un Médecin</label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => handleDoctorChange(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm"
                >
                  <option value="">-- Choisir un médecin --</option>
                  {catalog.flatMap(s => s.doctors)
                    .filter(d => selectedAppt.status !== 'CONFIRME' || d.speciality_id === selectedAppt.slot?.doctor?.speciality_id)
                    .map(doc => (
                      <option key={doc.id} value={doc.id}>
                        Dr. {doc.prenom} {doc.nom}
                      </option>
                    ))}
                </select>
              </div>

              {selectedDoctorId && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">2. Date souhaitée</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full border rounded-xl p-2.5 text-sm"
                  />
                </div>
              )}

              {selectedDate && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">3. Nouveau Créneau</label>
                  <select
                    value={selectedSlotId}
                    onChange={(e) => setSelectedSlotId(e.target.value)}
                    className="w-full border rounded-xl p-2.5 text-sm"
                  >
                    <option value="">-- Choisir une heure --</option>
                    {availableSlots.map(slot => (
                      <option key={slot.id} value={slot.id}>
                        {slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedAppt(null)}
                className="flex-1 py-2 border rounded-xl text-sm font-semibold text-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={!selectedSlotId || actionLoading}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                Confirmer le report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}