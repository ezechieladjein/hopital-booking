// src/PatientProfile.jsx
import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Calendar, Save, CheckCircle, AlertCircle, Shield, Plus, FileText, ExternalLink, CalendarCheck } from 'lucide-react';
import keycloak from './keycloak-init';
import { useTheme } from './context/ThemeContext';

const API_BASE_URL = 'http://localhost:8000/api';

export default function PatientProfile({ keycloakUuid }) {
  const { darkMode } = useTheme();
  
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    age: '',
    sexe: ''
  });

  const [insurances, setInsurances] = useState([]);
  const [showAddInsurance, setShowAddInsurance] = useState(false);
  const [newInsurance, setNewInsurance] = useState({
    insurance_name: '',
    policy_number: '',
    document: null
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingInsurance, setAddingInsurance] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (keycloakUuid) {
      loadProfileAndInsurances();
    }
  }, [keycloakUuid]);

  const getAuthHeaders = (isMultipart = false) => {
    const headers = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${keycloak.token}`,
    };
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  };

  const loadProfileAndInsurances = async () => {
    setLoading(true);
    try {
      const [profileRes, insurancesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/patients/${keycloakUuid}/profile`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/patients/${keycloakUuid}/insurances`, { headers: getAuthHeaders() })
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.success && profileData.data) {
          setFormData({
            nom: profileData.data.nom || '',
            prenom: profileData.data.prenom || '',
            email: profileData.data.email || '',
            telephone: profileData.data.telephone || '',
            age: profileData.data.age || '',
            sexe: profileData.data.sexe || ''
          });
        }
      }

      if (insurancesRes.ok) {
        const insData = await insurancesRes.json();
        if (insData.success) {
          setInsurances(insData.data || []);
        }
      }
    } catch (err) {
      console.error('Erreur lors du chargement des données:', err);
      setMessage({ type: 'error', text: 'Impossible de charger vos données depuis le serveur.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/patients/${keycloakUuid}/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Informations sauvegardées avec succès !' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Erreur lors de la sauvegarde.' });
      }
    } catch (err) {
      console.error('Erreur save profile:', err);
      setMessage({ type: 'error', text: 'Impossible de contacter le serveur backend.' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddInsurance = async (e) => {
    e.preventDefault();
    setAddingInsurance(true);

    const bodyFormData = new FormData();
    bodyFormData.append('insurance_name', newInsurance.insurance_name);
    bodyFormData.append('policy_number', newInsurance.policy_number);
    if (newInsurance.document) {
      bodyFormData.append('document', newInsurance.document);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/patients/${keycloakUuid}/insurances`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: bodyFormData
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Assurance ajoutée à votre profil avec succès !' });
        setNewInsurance({ insurance_name: '', policy_number: '', document: null });
        setShowAddInsurance(false);
        loadProfileAndInsurances();
      } else {
        setMessage({ type: 'error', text: data.message || 'Erreur lors de l\'ajout de l\'assurance.' });
      }
    } catch (err) {
      console.error('Erreur ajout assurance:', err);
      setMessage({ type: 'error', text: 'Erreur réseau lors de l\'envoi du document.' });
    } finally {
      setAddingInsurance(false);
    }
  };

  if (loading) {
    return <div className={`p-8 text-center font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Chargement du profil...</div>;
  }

  return (
    <div className={`max-w-4xl mx-auto space-y-8 font-['Poppins'] ${darkMode ? 'text-gray-200' : ''}`}>
      
      {/* SECTION 1 : INFORMATIONS PERSONNELLES */}
      <div className={`border rounded-2xl p-6 shadow-sm space-y-6 ${
        darkMode 
          ? 'bg-[#1E293B] border-gray-700' 
          : 'bg-white border-gray-100'
      }`}>
        <div className={`border-b pb-4 ${darkMode ? 'border-gray-700' : ''}`}>
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>Profil Patient</h2>
          <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Mettez à jour vos données personnelles enregistrées.</p>
        </div>

        {message.text && (
          <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${
            message.type === 'success' 
              ? darkMode ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : darkMode ? 'bg-rose-900/30 text-rose-300 border border-rose-800' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmitProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Nom</label>
              <input
                type="text"
                name="nom"
                value={formData.nom}
                onChange={handleChange}
                className={`w-full border p-2.5 rounded-xl text-sm outline-none focus:border-[#1565C0] ${
                  darkMode 
                    ? 'bg-[#111827] border-gray-600 text-gray-200' 
                    : 'bg-white border-gray-200'
                }`}
                required
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Prénom</label>
              <input
                type="text"
                name="prenom"
                value={formData.prenom}
                onChange={handleChange}
                className={`w-full border p-2.5 rounded-xl text-sm outline-none focus:border-[#1565C0] ${
                  darkMode 
                    ? 'bg-[#111827] border-gray-600 text-gray-200' 
                    : 'bg-white border-gray-200'
                }`}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full border p-2.5 rounded-xl text-sm outline-none focus:border-[#1565C0] ${
                  darkMode 
                    ? 'bg-[#111827] border-gray-600 text-gray-200' 
                    : 'bg-white border-gray-200'
                }`}
                required
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Téléphone</label>
              <input
                type="tel"
                name="telephone"
                value={formData.telephone}
                onChange={handleChange}
                className={`w-full border p-2.5 rounded-xl text-sm outline-none focus:border-[#1565C0] ${
                  darkMode 
                    ? 'bg-[#111827] border-gray-600 text-gray-200' 
                    : 'bg-white border-gray-200'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Âge</label>
              <input
                type="number"
                name="age"
                min="0"
                max="120"
                value={formData.age}
                onChange={handleChange}
                className={`w-full border p-2.5 rounded-xl text-sm outline-none focus:border-[#1565C0] ${
                  darkMode 
                    ? 'bg-[#111827] border-gray-600 text-gray-200' 
                    : 'bg-white border-gray-200'
                }`}
                placeholder="ex: 30"
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Sexe</label>
              <select
                name="sexe"
                value={formData.sexe}
                onChange={handleChange}
                className={`w-full border p-2.5 rounded-xl text-sm outline-none focus:border-[#1565C0] ${
                  darkMode 
                    ? 'bg-[#111827] border-gray-600 text-gray-200' 
                    : 'bg-white border-gray-200'
                }`}
              >
                <option value="">-- Sélectionnez --</option>
                <option value="M">Masculin (M)</option>
                <option value="F">Féminin (F)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#0D1B3D] text-white font-semibold text-xs rounded-xl flex items-center gap-2 hover:bg-opacity-90 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Sauvegarde...' : 'Sauvegarder le profil'}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2 : GESTION DES ASSURANCES DU PATIENT */}
      <div className={`border rounded-2xl p-6 shadow-sm space-y-6 ${
        darkMode 
          ? 'bg-[#1E293B] border-gray-700' 
          : 'bg-white border-gray-100'
      }`}>
        <div className={`flex justify-between items-center border-b pb-4 ${darkMode ? 'border-gray-700' : ''}`}>
          <div>
            <h3 className={`text-lg font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>
              <Shield className="w-5 h-5 text-[#1565C0]" /> Mes Assurances Santé
            </h3>
            <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Gérez vos contrats d'assurance et suivez leur utilisation lors des rendez-vous.</p>
          </div>
          <button
            onClick={() => setShowAddInsurance(!showAddInsurance)}
            className={`px-4 py-2 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition ${
              darkMode 
                ? 'bg-blue-900/30 text-blue-300 hover:bg-blue-900/50' 
                : 'bg-blue-50 text-[#1565C0] hover:bg-blue-100'
            }`}
          >
            <Plus className="w-4 h-4" />
            {showAddInsurance ? 'Annuler' : 'Ajouter une assurance'}
          </button>
        </div>

        {showAddInsurance && (
          <form onSubmit={handleAddInsurance} className={`p-4 border rounded-xl space-y-4 animate-fadeIn ${
            darkMode 
              ? 'bg-[#111827] border-gray-700' 
              : 'bg-gray-50'
          }`}>
            <h4 className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Nouvelle Assurance</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Nom de l'assurance</label>
                <input
                  type="text"
                  placeholder="Ex: NSIA, Sunu, Saham..."
                  value={newInsurance.insurance_name}
                  onChange={(e) => setNewInsurance({ ...newInsurance, insurance_name: e.target.value })}
                  className={`w-full border p-2 text-sm rounded-lg outline-none focus:border-[#1565C0] ${
                    darkMode 
                      ? 'bg-[#1E293B] border-gray-600 text-gray-200' 
                      : 'bg-white'
                  }`}
                  required
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Numéro de police / carte</label>
                <input
                  type="text"
                  placeholder="N° de contrat"
                  value={newInsurance.policy_number}
                  onChange={(e) => setNewInsurance({ ...newInsurance, policy_number: e.target.value })}
                  className={`w-full border p-2 text-sm rounded-lg outline-none focus:border-[#1565C0] ${
                    darkMode 
                      ? 'bg-[#1E293B] border-gray-600 text-gray-200' 
                      : 'bg-white'
                  }`}
                  required
                />
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Document justificatif (PDF, JPG, PNG)</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setNewInsurance({ ...newInsurance, document: e.target.files[0] })}
                className={`w-full text-xs file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 border rounded-lg p-1 cursor-pointer ${
                  darkMode 
                    ? 'bg-[#1E293B] border-gray-600 text-gray-400 file:bg-blue-900/30 file:text-blue-300' 
                    : 'bg-white'
                }`}
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={addingInsurance}
                className="px-4 py-2 bg-[#1565C0] text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
              >
                {addingInsurance ? 'Enregistrement...' : 'Enregistrer l\'assurance'}
              </button>
            </div>
          </form>
        )}

        {insurances.length === 0 ? (
          <div className={`text-center py-6 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Aucune assurance enregistrée pour le moment.
          </div>
        ) : (
          <div className="space-y-4">
            {insurances.map((ins) => (
              <div key={ins.id} className={`border rounded-xl p-4 space-y-3 ${
                darkMode 
                  ? 'bg-[#111827] border-gray-700 hover:border-blue-700' 
                  : 'bg-white hover:border-blue-200'
              } transition`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>{ins.insurance_name}</h4>
                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Police N° : <span className={`font-mono ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{ins.policy_number}</span></p>
                  </div>
                  {ins.document_path && (
                    <a
                      href={ins.document_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-xs hover:underline flex items-center gap-1 font-semibold ${darkMode ? 'text-blue-400' : 'text-[#1565C0]'}`}
                    >
                      <FileText className="w-3.5 h-3.5" /> Voir justificatif <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className={`pt-3 border-t -mx-4 -mb-4 p-4 rounded-b-xl flex flex-wrap justify-between items-center text-xs ${
                  darkMode 
                    ? 'bg-[#0B0F17] border-gray-700' 
                    : 'bg-gray-50/50'
                }`}>
                  <div className={`flex items-center gap-2 font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    <CalendarCheck className="w-4 h-4 text-[#1565C0]" />
                    <span>Utilisée dans <strong className={darkMode ? 'text-white' : ''}>{ins.usage_count || ins.appointments_count || 0}</strong> rendez-vous</span>
                  </div>

                  {ins.appointments && ins.appointments.length > 0 && (
                    <div className="flex gap-2">
                      {ins.appointments.slice(0, 3).map((apt) => (
                        <span
                          key={apt.id}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            apt.status === 'CONFIRME' ? 'bg-emerald-100 text-emerald-700' :
                            apt.status === 'EN_ATTENTE_VALIDATION' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          RDV #{apt.id} : {apt.status}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}