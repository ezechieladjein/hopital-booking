import React, { useState, useEffect } from "react";
import AppointmentChart from "./AppointmentChart";
import { apiFetch } from './api'; // 🔥 AJOUT (remplace axios)

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("stats");
  const [period, setPeriod] = useState("7d");
  const [stats, setStats] = useState(null);
  const [specialities, setSpecialities] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [unavailabilities, setUnavailabilities] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [animateChart, setAnimateChart] = useState(false);
  const [selectedSpecForDocs, setSelectedSpecForDocs] = useState(null);
  const [confirmedDetails, setConfirmedDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [newSpec, setNewSpec] = useState({
    nom: "",
    duree_consultation: 30,
    tarif: 10000,
  });
  const [editingSpec, setEditingSpec] = useState(null);
  const [newDoc, setNewDoc] = useState({
    nom: "",
    prenom: "",
    speciality_id: "",
  });
  const [newStaff, setNewStaff] = useState({
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
    role: "secretaire",
    password: "",
  });

  useEffect(() => {
    loadData();
  }, [period]);

  // 🔥 loadData avec apiFetch au lieu de axios
  const loadData = async () => {
    setLoading(true);
    setAnimateChart(false);
    try {
      const [statsData, specialitiesData, doctorsData, unavailabilitiesData, usersData] = await Promise.all([
        apiFetch(`/admin/stats?period=${period}`),
        apiFetch('/admin/specialities'),
        apiFetch('/admin/doctors'),
        apiFetch('/admin/unavailabilities').catch(() => ({ data: [] })),
        apiFetch('/admin/users/logs').catch(() => ({ data: [] })),
      ]);

      setStats(statsData.data);
      setSpecialities(specialitiesData.data);
      setDoctors(doctorsData.data);
      setUnavailabilities(unavailabilitiesData.data);
      setUsers(usersData.data);

      setTimeout(() => setAnimateChart(true), 150);
    } catch (err) {
      console.error("Erreur de synchronisation API :", err);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 handleOpenConfirmedDetails avec apiFetch
  const handleOpenConfirmedDetails = async () => {
    setLoadingDetails(true);
    try {
      const data = await apiFetch(`/admin/stats/confirmed-details?period=${period}`);
      setConfirmedDetails(data.data);
    } catch (err) {
      alert("Erreur lors de la récupération du détail des RDV");
    } finally {
      setLoadingDetails(false);
    }
  };

  // 🔥 handleAddSpeciality avec apiFetch
  const handleAddSpeciality = async (e) => {
    e.preventDefault();
    if (!newSpec.nom) return;
    try {
      await apiFetch('/admin/specialities', {
        method: 'POST',
        body: JSON.stringify(newSpec),
      });
      setNewSpec({ nom: "", duree_consultation: 30, tarif: 10000 });
      loadData();
    } catch (err) {
      alert(err.message || "Erreur lors de la création");
    }
  };

  // 🔥 handleUpdateSpeciality avec apiFetch
  const handleUpdateSpeciality = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/admin/specialities/${editingSpec.id}`, {
        method: 'PUT',
        body: JSON.stringify(editingSpec),
      });
      setEditingSpec(null);
      loadData();
    } catch (err) {
      alert(err.message || "Erreur lors de la modification");
    }
  };

  // 🔥 handleDeleteSpeciality avec apiFetch
  const handleDeleteSpeciality = async (id) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cette spécialité ?"))
      return;
    try {
      await apiFetch(`/admin/specialities/${id}`, {
        method: 'DELETE',
      });
      loadData();
    } catch (err) {
      alert(err.message || "Erreur lors de la suppression");
    }
  };

  // 🔥 handleAddDoctor avec apiFetch
  const handleAddDoctor = async (e) => {
    e.preventDefault();
    if (!newDoc.nom || !newDoc.prenom || !newDoc.speciality_id) return;
    try {
      await apiFetch('/admin/doctors', {
        method: 'POST',
        body: JSON.stringify(newDoc),
      });
      setNewDoc({ nom: "", prenom: "", speciality_id: "" });
      loadData();
    } catch (err) {
      alert("Erreur d'enregistrement du médecin");
    }
  };

  // 🔥 handleToggleDoctor avec apiFetch
  const handleToggleDoctor = async (id) => {
    try {
      await apiFetch(`/admin/doctors/${id}/toggle-status`, {
        method: 'PATCH',
      });
      loadData();
    } catch (err) {
      alert("Erreur de mise à jour du statut");
    }
  };

  // 🔥 handleCreateStaff avec apiFetch
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.password) {
      alert("Veuillez saisir un mot de passe pour la création du compte Keycloak.");
      return;
    }

    try {
      await apiFetch('/admin/users/staff', {
        method: 'POST',
        body: JSON.stringify(newStaff),
      });

      setNewStaff({
        nom: "",
        prenom: "",
        email: "",
        telephone: "",
        role: "secretaire",
        password: "",
      });
      alert("Compte créé avec succès dans Keycloak et BDD !");
      loadData();
    } catch (err) {
      alert(err.message || "Erreur lors de la création");
    }
  };

  if (loading && !stats) {
    return (
      <div className="p-12 text-center text-gray-500 font-semibold">
        Chargement de l'espace d'administration...
      </div>
    );
  }

  return (
    <div className="space-y-6 font-['Poppins']">
      {/* Barre de navigation / Onglets & Filtre de période */}
      <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "stats", label: "Statistiques" },
            { id: "specialities", label: `Spécialités (${specialities.length})` },
            { id: "doctors", label: `Médecins (${doctors.length})` },
            { id: "unavailabilities", label: `Absences (${unavailabilities.length})` },
            { id: "users", label: "Staff & Utilisateurs" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === tab.id
                  ? "bg-[#0D1B3D] text-white shadow-md"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "stats" && (
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
            <span className="text-[11px] font-bold text-gray-400 pl-2">Période :</span>
            {[
              { id: "7d", label: "7 jours" },
              { id: "30d", label: "30 jours" },
              { id: "90d", label: "3 mois" },
              { id: "1y", label: "1 an" },
              { id: "all", label: "Tout" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  period === p.id
                    ? "bg-white text-[#0D1B3D] shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 1. VUE : SUPERVISION & GRAPHES */}
      {activeTab === "stats" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-linear-to-br from-[#0D1B3D] to-[#1E293B] p-5 rounded-2xl border border-gray-800 text-white shadow-md">
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">
                Chiffre d'Affaires Net
              </p>
              <p className="text-2xl font-black text-emerald-400 mt-2">
                {stats?.total_revenue?.toLocaleString() ?? 0}{" "}
                <span className="text-xs text-white/70">FCFA</span>
              </p>
            </div>

            <div
              onClick={handleOpenConfirmedDetails}
              className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm cursor-pointer hover:border-emerald-300 hover:shadow-md transition group"
            >
              <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-gray-400 uppercase">RDV Confirmés</p>
                <span className="text-[10px] text-emerald-600 font-bold opacity-0 group-hover:opacity-100 transition">
                  Voir détails →
                </span>
              </div>
              <p className="text-3xl font-black text-[#2EAF5E] mt-2">
                {stats?.confirmed_appointments ?? 0}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Médecins (Actifs / Total)</p>
              <p className="text-3xl font-black text-[#0D1B3D] mt-2">
                {stats?.active_doctors ?? 0}
                <span className="text-sm font-normal text-gray-400"> / {stats?.total_doctors ?? 0}</span>
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Spécialités Actives</p>
              <p className="text-3xl font-black text-amber-500 mt-2">
                {stats?.total_specialities ?? 0}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Patients Enregistrés</p>
              <p className="text-3xl font-black text-indigo-600 mt-2">
                {stats?.total_patients ?? 0}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <AppointmentChart data={stats?.chart_data || []} />
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#0D1B3D]">
                Charge par Spécialité (Médecins rattachés)
              </h3>
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
                        style={{
                          width: `${Math.min(((spec.doctors_count ?? 0) / Math.max(doctors.length, 1)) * 100, 100)}%`,
                        }}
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
      {activeTab === "specialities" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit">
            <h2 className="text-base font-bold text-[#0D1B3D] mb-4">
              {editingSpec ? "Modifier la Spécialité" : "Nouvelle Spécialité"}
            </h2>
            <form onSubmit={editingSpec ? handleUpdateSpeciality : handleAddSpeciality} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nom de la Spécialité</label>
                <input
                  type="text"
                  value={editingSpec ? editingSpec.nom : newSpec.nom}
                  onChange={(e) =>
                    editingSpec
                      ? setEditingSpec({ ...editingSpec, nom: e.target.value })
                      : setNewSpec({ ...newSpec, nom: e.target.value })
                  }
                  placeholder="ex: Cardiologie"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0D1B3D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Durée consultation (minutes)</label>
                <input
                  type="number"
                  value={editingSpec ? editingSpec.duree_consultation : newSpec.duree_consultation}
                  onChange={(e) =>
                    editingSpec
                      ? setEditingSpec({ ...editingSpec, duree_consultation: parseInt(e.target.value) })
                      : setNewSpec({ ...newSpec, duree_consultation: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0D1B3D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Tarif (FCFA)</label>
                <input
                  type="number"
                  value={editingSpec ? editingSpec.tarif : newSpec.tarif}
                  onChange={(e) =>
                    editingSpec
                      ? setEditingSpec({ ...editingSpec, tarif: parseInt(e.target.value) })
                      : setNewSpec({ ...newSpec, tarif: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0D1B3D]"
                />
              </div>

              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-[#0D1B3D] text-white py-2.5 rounded-xl font-bold text-sm">
                  {editingSpec ? "Mettre à jour" : "Ajouter"}
                </button>
                {editingSpec && (
                  <button
                    type="button"
                    onClick={() => setEditingSpec(null)}
                    className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm"
                  >
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
                        {spec.doctors_count ?? 0} Médecin(s)
                      </button>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => setEditingSpec(spec)}
                        className="text-xs font-bold text-gray-600 hover:underline"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDeleteSpeciality(spec.id)}
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. VUE : MÉDECINS */}
      {activeTab === "doctors" && (
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
                    <option key={s.id} value={s.id}>
                      {s.nom}
                    </option>
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
                    <td className="p-4 text-gray-600 font-medium">{doc.speciality?.nom ?? "Non assigné"}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        doc.status === "actif" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleToggleDoctor(doc.id)}
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        {doc.status === "actif" ? "Désactiver" : "Activer"}
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
      {activeTab === "unavailabilities" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-[#0D1B3D]">Registre des Absences et Indisponibilités Saisies</h2>
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
                <tr>
                  <td colSpan="6" className="p-4 text-center text-gray-400">Aucune absence enregistrée.</td>
                </tr>
              ) : (
                unavailabilities.map((u) => (
                  <tr key={u.id}>
                    <td className="p-3 font-bold text-[#0D1B3D]">Dr. {u.doctor?.prenom} {u.doctor?.nom}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-xs">{u.type}</span>
                    </td>
                    <td className="p-3 text-gray-600">{u.reason ?? "N/C"}</td>
                    <td className="p-3 text-gray-500 font-mono text-xs">{u.start_datetime} au {u.end_datetime}</td>
                    <td className="p-3 text-gray-600">{u.creator ? `${u.creator.prenom} ${u.creator.nom}` : "N/C"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${u.status === "ACTIF" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
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
      {activeTab === "users" && (
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
                <label className="block text-xs font-bold text-gray-500 mb-1">Mot de passe Keycloak</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
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
            <h2 className="text-base font-bold text-[#0D1B3D]">Liste des Utilisateurs</h2>
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
                    <td className="p-3 text-gray-500 font-mono text-xs">{u.telephone ?? "N/C"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        u.role === "administrateur" ? "bg-purple-100 text-purple-700" :
                        u.role === "secretaire" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-700"
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

      {/* MODALES */}
      {selectedSpecForDocs && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-[#0D1B3D] text-base">Médecins en {selectedSpecForDocs.nom}</h3>
              <button
                onClick={() => setSelectedSpecForDocs(null)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 font-bold hover:bg-gray-200 transition flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {doctors.filter((d) => d.speciality_id === selectedSpecForDocs.id).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6 font-medium">
                  Aucun médecin n'est actuellement rattaché à cette spécialité.
                </p>
              ) : (
                doctors
                  .filter((d) => d.speciality_id === selectedSpecForDocs.id)
                  .map((doc) => (
                    <div key={doc.id} className="p-3 bg-gray-50 rounded-xl flex justify-between items-center text-sm border border-gray-100">
                      <span className="font-bold text-[#0D1B3D]">Dr. {doc.prenom} {doc.nom}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        doc.status === "actif" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
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

      {(confirmedDetails || loadingDetails) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-3xl w-full space-y-4 shadow-xl border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-[#0D1B3D] text-base">Détail des RDV Confirmés & Honorés</h3>
                <p className="text-xs text-gray-400">Période : <span className="font-bold text-[#0D1B3D]">{period}</span></p>
              </div>
              <button
                onClick={() => setConfirmedDetails(null)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 font-bold hover:bg-gray-200 transition flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {loadingDetails ? (
              <p className="text-center py-8 text-sm text-gray-500 font-medium">Chargement des détails...</p>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 font-bold text-gray-400 uppercase">
                    <tr>
                      <th className="p-3">Patient</th>
                      <th className="p-3">Médecin</th>
                      <th className="p-3">Spécialité</th>
                      <th className="p-3">Date RDV</th>
                      <th className="p-3">Statut</th>
                      <th className="p-3 text-right">Tarif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {confirmedDetails?.map((app) => (
                      <tr key={app.id}>
                        <td className="p-3 font-bold text-[#0D1B3D]">
                          {app.patient ? `${app.patient.prenom} ${app.patient.nom}` : "N/C"}
                        </td>
                        <td className="p-3 text-gray-600">Dr. {app.doctor?.prenom} {app.doctor?.nom}</td>
                        <td className="p-3 text-gray-500">{app.speciality?.nom}</td>
                        <td className="p-3 font-mono">{app.appointment_date}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 font-bold">{app.status}</span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-[#2EAF5E]">
                          {app.amount_paid?.toLocaleString()} FCFA
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              onClick={() => setConfirmedDetails(null)}
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