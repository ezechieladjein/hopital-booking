import React, { useState, useEffect } from 'react';

export default function SecretaryDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [coverageRate, setCoverageRate] = useState('');
  const [updating, setUpdating] = useState(false);

  // Charger les rendez-vous de la clinique
  const fetchAppointments = () => {
    setLoading(true);
    fetch('http://localhost:8000/api/secretary/appointments')
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success) {
          setAppointments(resData.data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erreur lors de la récupération des rendez-vous:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  // Enregistrer la validation d'assurance avec le taux choisi
  const handleValidateInsurance = () => {
    if (!selectedAppointment || !coverageRate) return;
    setUpdating(true);

    fetch('http://localhost:8000/api/secretary/validate-insurance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        appointment_id: selectedAppointment.id,
        insurance_coverage_rate: parseInt(coverageRate, 10),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert('Prise en charge validée avec succès !');
          setSelectedAppointment(null);
          setCoverageRate('');
          fetchAppointments(); // Rafraîchir le tableau
        } else {
          alert(`Erreur : ${data.message}`);
        }
      })
      .catch((err) => {
        console.error('Erreur lors de la validation:', err);
        alert('Une erreur est survenue lors de la validation de la prise en charge.');
      })
      .finally(() => {
        setUpdating(false);
      });
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Chargement de l'historique...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 font-['Poppins']">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#0D1B3D]">Espace Secrétariat - Medigo</h2>
          <p className="text-xs text-gray-400 mt-0.5">Suivi des rendez-vous et validation des prises en charge d'assurance</p>
        </div>
        <button 
          onClick={fetchAppointments}
          className="text-xs font-bold text-[#1565C0] hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition"
        >
          Rafraîchir
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 text-xs font-bold uppercase tracking-wider">
              <th className="py-3 px-4">ID</th>
              <th className="py-3 px-4">Patient</th>
              <th className="py-3 px-4">Médecin & Spécialité</th>
              <th className="py-3 px-4">Date & Heure</th>
              <th className="py-3 px-4">Assurance</th>
              <th className="py-3 px-4 text-right">Reste à payer</th>
              <th className="py-3 px-4 text-center">Statut</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
            {appointments.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-8 text-gray-400">
                  Aucun rendez-vous enregistré.
                </td>
              </tr>
            ) : (
              appointments.map((appt) => (
                <tr key={appt.id} className="hover:bg-gray-50/50 transition">
                  <td className="py-3.5 px-4 font-semibold text-gray-400">#{appt.id}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-[#0D1B3D]">
                      {appt.patient?.nom} {appt.patient?.prenom}
                    </div>
                    <div className="text-xs text-gray-400">{appt.patient?.email}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-gray-800">
                      Dr. {appt.slot?.doctor?.nom} {appt.slot?.doctor?.prenom}
                    </div>
                    <div className="text-xs text-blue-600 font-semibold">
                      {appt.slot?.doctor?.speciality?.nom}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium">
                      {new Date(appt.slot?.date_consultation).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="text-xs text-gray-400">
                      à {appt.slot?.start_time.substring(0, 5)}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {appt.has_insurance ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#1565C0]">
                        {appt.insurance_name}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Sans assurance</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-[#0D1B3D]">
                    {parseInt(appt.amount_to_pay).toLocaleString()} XOF
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      appt.status === 'CONFIRME'
                        ? 'bg-emerald-50 text-emerald-700'
                        : appt.status === 'EN_ATTENTE_VALIDATION'
                        ? 'bg-blue-50 text-blue-700'
                        : appt.status === 'EN_ATTENTE_PAIEMENT'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {appt.status === 'EN_ATTENTE_VALIDATION' 
                        ? 'À valider' 
                        : appt.status === 'EN_ATTENTE_PAIEMENT' 
                        ? 'Attente paiement' 
                        : appt.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {/* 🚀 LOGIQUE MISE À JOUR : Le bouton s'affiche uniquement s'il y a une assurance */}
                    {appt.has_insurance && appt.status === 'EN_ATTENTE_VALIDATION' ? (
                      <button
                        onClick={() => setSelectedAppointment(appt)}
                        className="bg-[#1565C0] hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition"
                      >
                        Gérer l'Assurance
                      </button>
                    ) : appt.has_insurance ? (
                      <span className="text-xs text-gray-400 italic">Traitée ({appt.insurance_coverage_rate}%)</span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Aucune action</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 🚀 MODALE DE VALIDATION MISE À JOUR : Affiche les détails soumis et le justificatif */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-[#0d1b3d]/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-lg border border-gray-100 animate-fadeIn font-['Poppins']">
            <h3 className="text-lg font-bold text-[#0D1B3D] mb-4 flex items-center gap-2">
              🛡️ Validation d'Assurance - RDV #{selectedAppointment.id}
            </h3>

            {/* Détails fournis par le Patient */}
            <div className="bg-gray-50 p-4 rounded-xl mb-4 space-y-2 text-sm text-gray-700 border border-gray-100">
              <p><strong>Patient :</strong> {selectedAppointment.patient?.nom} {selectedAppointment.patient?.prenom}</p>
              <p><strong>Compagnie d'assurance :</strong> {selectedAppointment.insurance_name}</p>
              <p><strong>Numéro de Police :</strong> <span className="font-mono text-xs font-semibold">{selectedAppointment.insurance_policy_number}</span></p>
              
              {selectedAppointment.insurance_document_path ? (
                <div className="pt-2 border-t border-gray-150 mt-2">
                  <a
                    href={selectedAppointment.insurance_document_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    📂 Visualiser la carte / contrat ↗
                  </a>
                </div>
              ) : (
                <p className="text-xs text-red-500 italic mt-2">Aucun document téléversé</p>
              )}
            </div>

            {/* Saisie du Taux */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
                Taux de couverture accordé (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Ex: 80"
                  value={coverageRate}
                  onChange={(e) => setCoverageRate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
                <span className="absolute right-4 top-2.5 text-gray-400 font-bold">%</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => {
                  setSelectedAppointment(null);
                  setCoverageRate('');
                }}
                disabled={updating}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition"
              >
                Fermer
              </button>
              <button
                onClick={handleValidateInsurance}
                disabled={updating || !coverageRate}
                className="px-5 py-2 text-xs font-bold bg-[#2EAF5E] hover:bg-emerald-600 text-white rounded-xl transition flex items-center gap-1.5 shadow-sm"
              >
                {updating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Validation...
                  </>
                ) : (
                  'Confirmer & Appliquer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}