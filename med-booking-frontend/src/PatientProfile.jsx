import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Calendar, Save, CheckCircle, AlertCircle } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000/api';

export default function PatientProfile({ keycloakUuid }) {
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    age: '',
    sexe: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (keycloakUuid) {
      fetchUserProfile();
    }
  }, [keycloakUuid]);

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/patients/${keycloakUuid}/profile`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      const data = await res.json();
      
      if (data.success && data.data) {
        setFormData({
          nom: data.data.nom || '',
          prenom: data.data.prenom || '',
          email: data.data.email || '',
          telephone: data.data.telephone || '',
          age: data.data.age || '',
          sexe: data.data.sexe || ''
        });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Impossible de charger vos informations depuis le serveur.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/patients/${keycloakUuid}/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Informations sauvegardées avec succès !' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Erreur lors de la sauvegarde.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Impossible de contacter le serveur backend (Vérifiez le port ou la connexion).' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 font-medium">Chargement du profil...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto bg-white border rounded-2xl p-6 shadow-sm space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-xl font-bold text-[#0D1B3D]">Profil Patient</h2>
        <p className="text-xs text-gray-500">Mettez à jour vos données enregistrées en base de données.</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nom</label>
            <input
              type="text"
              name="nom"
              value={formData.nom}
              onChange={handleChange}
              className="w-full border p-2.5 rounded-xl text-sm outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Prénom</label>
            <input
              type="text"
              name="prenom"
              value={formData.prenom}
              onChange={handleChange}
              className="w-full border p-2.5 rounded-xl text-sm outline-none focus:border-indigo-500"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full border p-2.5 rounded-xl text-sm outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              name="telephone"
              value={formData.telephone}
              onChange={handleChange}
              className="w-full border p-2.5 rounded-xl text-sm outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Âge</label>
            <input
              type="number"
              name="age"
              min="0"
              max="120"
              value={formData.age}
              onChange={handleChange}
              className="w-full border p-2.5 rounded-xl text-sm outline-none focus:border-indigo-500"
              placeholder="ex: 30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Sexe</label>
            <select
              name="sexe"
              value={formData.sexe}
              onChange={handleChange}
              className="w-full border p-2.5 rounded-xl text-sm outline-none bg-white focus:border-indigo-500"
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
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </form>
    </div>
  );
}