<?php

namespace database\seeders;

use App\Models\Speciality;
use App\Models\Doctor;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Définition des spécialités avec Tarifs (FCFA) et Durées (Minutes)
        $specsData = [
            'Cardiologie' => ['tarif' => 25000, 'duree' => 30],
            'Dermatologie' => ['tarif' => 20000, 'duree' => 20],
            'Gynécologie' => ['tarif' => 20000, 'duree' => 25],
            'Pédiatrie' => ['tarif' => 15000, 'duree' => 20],
            'Ophtalmologie' => ['tarif' => 18000, 'duree' => 15],
            'Médecine Générale' => ['tarif' => 10000, 'duree' => 15],
            'Neurologie' => ['tarif' => 30000, 'duree' => 45],
        ];

        $specialities = [];
        foreach ($specsData as $name => $details) {
            $specialities[$name] = Speciality::create([
                'nom' => $name,
                'tarif' => $details['tarif'],
                'duree_consultation' => $details['duree'],
                'is_active' => true
            ]);
        }

        // 2. Liste brute des 37 médecins répartis par spécialités
        $doctorsList = [
            'Cardiologie' => [
                ['nom' => 'AGBOSSA', 'prenom' => 'Jean-Marie'],
                ['nom' => 'ADANHOUME', 'prenom' => 'Marcelle'],
                ['nom' => 'HOUNGBE', 'prenom' => 'Armand'],
                ['nom' => 'KPADONOU', 'prenom' => 'Thierry'],
                ['nom' => 'SESSOU', 'prenom' => 'Evelyne']
            ],
            'Dermatologie' => [
                ['nom' => 'ZANNOU', 'prenom' => 'Florent'],
                ['nom' => 'DOSSOU', 'prenom' => 'Clotilde'],
                ['nom' => 'BIO', 'prenom' => 'Ousmane'],
                ['nom' => 'TOSSOU', 'prenom' => 'Béatrice'],
                ['nom' => 'GANGNIBO', 'prenom' => 'Félix']
            ],
            'Gynécologie' => [
                ['nom' => 'AMOUSSU', 'prenom' => 'Gérard'],
                ['nom' => 'LALEYE', 'prenom' => 'Nafiou'],
                ['nom' => 'CHABI', 'prenom' => 'Yvette'],
                ['nom' => 'KODO', 'prenom' => 'Félicienne'],
                ['nom' => 'CODJIA', 'prenom' => 'Justin']
            ],
            'Pédiatrie' => [
                ['nom' => 'AHOUANGNIVO', 'prenom' => 'Christian'],
                ['nom' => 'SOULE', 'prenom' => 'Mariam'],
                ['nom' => 'VODOUHE', 'prenom' => 'Gisèle'],
                ['nom' => 'AKPO', 'prenom' => 'Sylvestre'],
                ['nom' => 'MENSAH', 'prenom' => 'Colette'],
                ['nom' => 'BEHANZIN', 'prenom' => 'Rodrigue']
            ],
            'Ophtalmologie' => [
                ['nom' => 'ALLADAYE', 'prenom' => 'Pascal'],
                ['nom' => 'ATTIKPA', 'prenom' => 'Delphine'],
                ['nom' => 'DEGUENON', 'prenom' => 'Mathias'],
                ['nom' => 'KPANOU', 'prenom' => 'Angèle'],
                ['nom' => 'SONON', 'prenom' => 'Hubert']
            ],
            'Médecine Générale' => [
                ['nom' => 'DANSOU', 'prenom' => 'Aimé'],
                ['nom' => 'GOMEZ', 'prenom' => 'Lucie'],
                ['nom' => 'LAWSON', 'prenom' => 'Arnaud'],
                ['nom' => 'BAKO', 'prenom' => 'Saliou'],
                ['nom' => 'HOUNKPONOU', 'prenom' => 'Valérie'],
                ['nom' => 'AÏSSI', 'prenom' => 'Julienne']
            ],
            'Neurologie' => [
                ['nom' => 'TCHIBOZO', 'prenom' => 'Romaric'],
                ['nom' => 'GBEDOLO', 'prenom' => 'Anatole'],
                ['nom' => 'YESSOUFOU', 'prenom' => 'Raouf'],
                ['nom' => 'ALAZA', 'prenom' => 'Karim'],
                ['nom' => 'SAÏZONOU', 'prenom' => 'Ghislaine']
            ],
        ];

        // 3. Insertion des médecins reliés à leur identifiant de spécialité
        foreach ($doctorsList as $specName => $doctors) {
            if (isset($specialities[$specName])) {
                foreach ($doctors as $doc) {
                    Doctor::create([
                        'speciality_id' => $specialities[$specName]->id,
                        'nom' => $doc['nom'],
                        'prenom' => $doc['prenom'],
                        'status' => 'actif'
                    ]);
                }
            }
        }
    }
}