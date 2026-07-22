import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/admin';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('stats');
  
  // Données Globales
  const [stats, setStats] = useState(null);
  const [specialities, setSpecialities] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Animation Graphe Flux RDV
  const [animateChart, setAnimateChart] = useState(false);

  // État Modale Médecins par Spécialité
  const [selectedSpecForDocs, setSelectedSpecForDocs] = useState(null);

  // Formulaires
  const [newSpec, setNewSpec] = useState({ nom: '', duree_consultation: 30, tarif: 10000 });
  const [editingSpec, setEditingSpec] = useState(null);
  const [newDoc, setNewDoc] = useState({ nom: '', prenom: '', speciality_id: '' });
  const [newStaff, setNewStaff] = useState({ nom: '', prenom: '', email: '', telephone: '', role: 'secretaire' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setAnimateChart(false);
    try {
      const [resStats, resSpecs, resDocs, resUnavail, resUsers] = await Promise.all([
        axios.get(`${API_BASE}/stats`),
        axios.get(`${API_BASE}/specialities`),
        axios.get(`${API_BASE}/doctors`),
        axios.get(`${API_BASE}/unavailabilities`).catch(() => ({ data: { data: [] } })),
        axios.get(`${API_BASE}/users/logs`).catch(() => ({ data: { data: [] } }))
      ]);

      setStats(resStats.data.data);
      setSpecialities(resSpecs.data.data);
      setDoctors(resDocs.data.data);
      setUnavailabilities(resUnavail.data.data);
      setUsers(resUsers.data.data);

      setTimeout(() => setAnimateChart(true), 150);
    } catch (err) {
      console.error("Erreur de synchronisation API :", err);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS SPÉCIALITÉS ---
  const handleAddSpeciality = async (e) => {
    e.preventDefault();
    if (!newSpec.nom) return;
    try {
      await axios.post(`${API_BASE}/specialities`, newSpec);
      setNewSpec({ nom: '', duree_consultation: 30, tarif: 10000 });
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Erreur lors de la création");
    }
  };

  const handleUpdateSpeciality = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_BASE}/specialities/${editingSpec.id}`, editingSpec);
      setEditingSpec(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Erreur lors de la modification");
    }
  };

  const handleDeleteSpeciality = async (id) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cette spécialité ?")) return;
    try {
      await axios.delete(`${API_BASE}/specialities/${id}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Erreur lors de la suppression");
    }
  };

  // --- ACTIONS MÉDECINS ---
  const handleAddDoctor = async (e) => {
    e.preventDefault();
    if (!newDoc.nom || !newDoc.prenom || !newDoc.speciality_id) return;
    try {
      await axios.post(`${API_BASE}/doctors`, newDoc);
      setNewDoc({ nom: '', prenom: '', speciality_id: '' });
      loadData();
    } catch (err) {
      alert("Erreur d'enregistrement du médecin");
    }
  };

  const handleToggleDoctor = async (id) => {
    try {
      await axios.patch(`${API_BASE}/doctors/${id}/toggle-status`);
      loadData();
    } catch (err) {
      alert("Erreur de mise à jour du statut");
    }
  };

  // --- ACTIONS STAFF ---
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/users/staff`, newStaff);
      setNewStaff({ nom: '', prenom: '', email: '', telephone: '', role: 'secretaire' });
      alert("Compte créé avec succès !");
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Erreur lors de la création");
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 font-semibold">
        Chargement de l'espace d'administration
      </div>
    );
  }

  return (
    <div className="space-y-6 font-['Poppins']">
      
      {/* Barre de navigation / Onglets */}
      <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-2">
        {[
          { id: 'stats', label: 'Statistiques' },
          { id: 'specialities', label: `Spécialités (${specialities.length})` },
          { id: 'doctors', label: `Médecins (${doctors.length})` },
          { id: 'unavailabilities', label: `Absences (${unavailabilities.length})` },
          { id: 'users', label: ' Staff & Utilisateurs' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === tab.id ? 'bg-[#0D1B3D] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. VUE : SUPERVISION & GRAPHES */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          
          {/* Cartes Métriques */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Médecins (Actifs / Total)</p>
              <p className="text-3xl font-black text-[#0D1B3D] mt-2">
                {stats?.active_doctors ?? 0}
                <span className="text-sm font-normal text-gray-400"> / {stats?.total_doctors ?? 0}</span>
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">RDV Confirmés</p>
              <p className="text-3xl font-black text-[#2EAF5E] mt-2">{stats?.confirmed_appointments ?? 0}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Spécialités Actives</p>
              <p className="text-3xl font-black text-amber-500 mt-2">{stats?.total_specialities ?? 0}</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Patients Enregistrés</p>
              <p className="text-3xl font-black text-indigo-600 mt-2">{stats?.total_patients ?? 0}</p>
            </div>
          </div>

          {/* Graphiques */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Graphe 1: Flux RDV Confirmés */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#0D1B3D]">Flux des Rendez-vous Confirmés (7 derniers jours)</h3>
              <div className="h-48 flex items-end justify-between gap-3 pt-6 border-b border-gray-100 pb-2">
                {stats?.weekly_appointments?.map((item, idx) => {
                  const maxCount = Math.max(...stats.weekly_appointments.map(a => a.count), 1);
                  const heightPercent = (item.count / maxCount) * 100;
                  
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <span className="text-[10px] font-bold text-gray-500">{item.count}</span>
                      <div 
                        style={{ height: animateChart ? `${Math.max(heightPercent, 6)}%` : '0%' }} 
                        className="w-full bg-[#0D1B3D] rounded-t-md transition-all duration-700 ease-out hover:bg-[#2EAF5E]"
                      />
                      <span className="text-[10px] font-bold text-gray-400 uppercase">{item.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Graphe 2: Charge par Spécialité */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#0D1B3D]">🩺 Charge par Spécialité (Médecins rattachés)</h3>
              <div className="space-y-4 pt-2 max-h-48 overflow-y-auto">
                {specialities.map((spec) => (
                  <div key={spec.id} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-gray-700">{spec.nom}</span>
                      <span className="text-gray-400">{spec.doctors_count ?? 0} Médecin(s)</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#2EAF5E] h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(((spec.doctors_count ?? 0) / Math.max(doctors.length, 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 2. VUE : SPÉCIALITÉS */}
      {activeTab === 'specialities' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit">
            <h2 className="text-base font-bold text-[#0D1B3D] mb-4">
              {editingSpec ? 'Modifier la Spécialité' : 'Nouvelle Spécialité'}
            </h2>
            <form onSubmit={editingSpec ? handleUpdateSpeciality : handleAddSpeciality} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nom de la Spécialité</label>
                <input
                  type="text"
                  value={editingSpec ? editingSpec.nom : newSpec.nom}
                  onChange={(e) => editingSpec 
                    ? setEditingSpec({ ...editingSpec, nom: e.target.value })
                    : setNewSpec({ ...newSpec, nom: e.target.value })}
                  placeholder="ex: Cardiologie"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0D1B3D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Durée consultation (minutes)</label>
                <input
                  type="number"
                  value={editingSpec ? editingSpec.duree_consultation : newSpec.duree_consultation}
                  onChange={(e) => editingSpec 
                    ? setEditingSpec({ ...editingSpec, duree_consultation: parseInt(e.target.value) })
                    : setNewSpec({ ...newSpec, duree_consultation: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0D1B3D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Tarif (FCFA)</label>
                <input
                  type="number"
                  value={editingSpec ? editingSpec.tarif : newSpec.tarif}
                  onChange={(e) => editingSpec 
                    ? setEditingSpec({ ...editingSpec, tarif: parseInt(e.target.value) })
                    : setNewSpec({ ...newSpec, tarif: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0D1B3D]"
                />
              </div>

              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-[#0D1B3D] text-white py-2.5 rounded-xl font-bold text-sm">
                  {editingSpec ? 'Mettre à jour' : 'Ajouter'}
                </button>
                {editingSpec && (
                  <button type="button" onClick={() => setEditingSpec(null)} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm">
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm lg:col-span-2 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase border-b border-gray-100">
                <tr>
                  <th className="p-4">Spécialité</th>
                  <th className="p-4">Durée</th>
                  <th className="p-4">Tarif</th>
                  <th className="p-4">Médecins Rattachés</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {specialities.map((spec) => (
                  <tr key={spec.id} className="hover:bg-gray-50/50">
                    <td className="p-4 font-bold text-[#0D1B3D]">{spec.nom}</td>
                    <td className="p-4 text-gray-600 font-medium">{spec.duree_consultation} min</td>
                    <td className="p-4 font-mono font-bold text-[#2EAF5E]">{spec.tarif?.toLocaleString()} FCFA</td>
                    <td className="p-4">
                      <button 
                        onClick={() => setSelectedSpecForDocs(spec)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs transition flex items-center gap-1.5"
                      >
                        👁️ {spec.doctors_count ?? 0} Médecin(s)
                      </button>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button onClick={() => setEditingSpec(spec)} className="text-xs font-bold text-gray-600 hover:underline">Modifier</button>
                      <button onClick={() => handleDeleteSpeciality(spec.id)} className="text-xs font-bold text-red-600 hover:underline">Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. VUE : MÉDECINS */}
      {activeTab === 'doctors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit">
            <h2 className="text-base font-bold text-[#0D1B3D] mb-4">Nouveau Médecin</h2>
            <form onSubmit={handleAddDoctor} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Prénom</label>
                <input
                  type="text"
                  value={newDoc.prenom}
                  onChange={(e) => setNewDoc({ ...newDoc, prenom: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0D1B3D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nom</label>
                <input
                  type="text"
                  value={newDoc.nom}
                  onChange={(e) => setNewDoc({ ...newDoc, nom: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0D1B3D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Spécialité</label>
                <select
                  value={newDoc.speciality_id}
                  onChange={(e) => setNewDoc({ ...newDoc, speciality_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0D1B3D]"
                >
                  <option value="">Sélectionnez une spécialité</option>
                  {specialities.map((s) => (
                    <option key={s.id} value={s.id}>{s.nom}</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full bg-[#0D1B3D] text-white py-2.5 rounded-xl font-bold text-sm">
                Enregistrer Médecin
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm lg:col-span-2 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase border-b border-gray-100">
                <tr>
                  <th className="p-4">Nom du Médecin</th>
                  <th className="p-4">Spécialité</th>
                  <th className="p-4">Statut</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {doctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/50">
                    <td className="p-4 font-bold text-[#0D1B3D]">Dr. {doc.prenom} {doc.nom}</td>
                    <td className="p-4 text-gray-600 font-medium">{doc.speciality?.nom ?? 'Non assigné'}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        doc.status === 'actif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => handleToggleDoctor(doc.id)} className="text-xs font-bold text-indigo-600 hover:underline">
                        {doc.status === 'actif' ? 'Désactiver' : 'Activer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. VUE : ABSENCES MÉDECINS */}
      {activeTab === 'unavailabilities' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-[#0D1B3D]">📅 Registre des Absences et Indisponibilités Saisies</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase border-b border-gray-100">
              <tr>
                <th className="p-3">Médecin</th>
                <th className="p-3">Type</th>
                <th className="p-3">Motif</th>
                <th className="p-3">Période</th>
                <th className="p-3">Saisi par</th>
                <th className="p-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {unavailabilities.length === 0 ? (
                <tr><td colSpan="6" className="p-4 text-center text-gray-400">Aucune absence enregistrée.</td></tr>
              ) : (
                unavailabilities.map((u) => (
                  <tr key={u.id}>
                    <td className="p-3 font-bold text-[#0D1B3D]">Dr. {u.doctor?.prenom} {u.doctor?.nom}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-xs">{u.type}</span></td>
                    <td className="p-3 text-gray-600">{u.reason ?? 'N/C'}</td>
                    <td className="p-3 text-gray-500 font-mono text-xs">{u.start_datetime} au {u.end_datetime}</td>
                    <td className="p-3 text-gray-600">{u.creator ? `${u.creator.prenom} ${u.creator.nom}` : 'N/C'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${u.status === 'ACTIF' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. VUE : STAFF & COMPTES */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit">
            <h2 className="text-base font-bold text-[#0D1B3D] mb-4">Créer Utilisateur Staff</h2>
            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Prénom</label>
                <input
                  type="text"
                  value={newStaff.prenom}
                  onChange={(e) => setNewStaff({ ...newStaff, prenom: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0D1B3D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nom</label>
                <input
                  type="text"
                  value={newStaff.nom}
                  onChange={(e) => setNewStaff({ ...newStaff, nom: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0D1B3D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0D1B3D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Téléphone</label>
                <input
                  type="text"
                  value={newStaff.telephone}
                  onChange={(e) => setNewStaff({ ...newStaff, telephone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0D1B3D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Rôle</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0D1B3D]"
                >
                  <option value="secretaire">Secrétaire</option>
                  <option value="administrateur">Administrateur</option>
                </select>
              </div>

              <button type="submit" className="w-full bg-[#0D1B3D] text-white py-2.5 rounded-xl font-bold text-sm">
                Enregistrer dans BDD
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm lg:col-span-2 overflow-hidden p-6 space-y-4">
            <h2 className="text-base font-bold text-[#0D1B3D]">🔍 Liste des Utilisateurs (`users`)</h2>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase border-b border-gray-100">
                <tr>
                  <th className="p-3">Nom & Prénom</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Téléphone</th>
                  <th className="p-3">Rôle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="p-3 font-bold text-[#0D1B3D]">{u.prenom} {u.nom}</td>
                    <td className="p-3 text-gray-600">{u.email}</td>
                    <td className="p-3 text-gray-500 font-mono text-xs">{u.telephone ?? 'N/C'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        u.role === 'administrateur' ? 'bg-purple-100 text-purple-700' :
                        u.role === 'secretaire' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODALE : NOM DES MÉDECINS PAR SPÉCIALITÉ */}
      {selectedSpecForDocs && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-[#0D1B3D] text-base">
                Médecins en {selectedSpecForDocs.nom}
              </h3>
              <button 
                onClick={() => setSelectedSpecForDocs(null)} 
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 font-bold hover:bg-gray-200 transition flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {doctors.filter(d => d.speciality_id === selectedSpecForDocs.id).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6 font-medium">
                  Aucun médecin n'est actuellement rattaché à cette spécialité.
                </p>
              ) : (
                doctors
                  .filter(d => d.speciality_id === selectedSpecForDocs.id)
                  .map((doc) => (
                    <div key={doc.id} className="p-3 bg-gray-50 rounded-xl flex justify-between items-center text-sm border border-gray-100">
                      <span className="font-bold text-[#0D1B3D]">
                        Dr. {doc.prenom} {doc.nom}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        doc.status === 'actif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {doc.status}
                      </span>
                    </div>
                  ))
              )}
            </div>

            <button 
              onClick={() => setSelectedSpecForDocs(null)} 
              className="w-full py-2.5 bg-[#0D1B3D] text-white rounded-xl text-xs font-bold hover:bg-opacity-90 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

    </div>
  );
}