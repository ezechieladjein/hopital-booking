<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use StevenMaguire\OAuth2\Client\Provider\Keycloak;
use Illuminate\Support\Facades\Http;
use App\Models\Speciality;
use App\Models\Doctor;
use App\Models\Appointment;
use App\Models\DoctorUnavailability;
use App\Models\User;
use Carbon\Carbon;

class AdminController extends Controller
{
    private function getStartDate(string $period): ?Carbon
    {
        return match ($period) {
            '7d'  => Carbon::now()->subDays(7)->startOfDay(),
            '30d' => Carbon::now()->subDays(30)->startOfDay(),
            '90d' => Carbon::now()->subDays(90)->startOfDay(),
            '1y'  => Carbon::now()->subYear()->startOfDay(),
            default => null, // 'all'
        };
    }

    /**
     * Statistiques globales + Graphique
     */
    public function getStats(Request $request): JsonResponse
    {
        $period = $request->query('period', '7d');
        $startDate = $this->getStartDate($period);

        // 1. Requêtes de base filtrées sur slots.date_consultation
        $confirmedQuery = Appointment::whereIn('appointments.status', ['CONFIRME', 'TERMINE', 'ABSENT'])
            ->join('slots', 'appointments.slot_id', '=', 'slots.id');

        if ($startDate) {
            $confirmedQuery->where('slots.date_consultation', '>=', $startDate);
        }

        // 2. Nombre de RDV Confirmés / Honorés
        $confirmedCount = (clone $confirmedQuery)->count();

        // 3. Chiffre d'Affaires Net (Somme de amount_to_pay pour les RDV confirmés/terminés)
        $totalRevenue = (clone $confirmedQuery)->sum('appointments.amount_to_pay');

        // 4. Données pour le Graphique
        $chartQuery = DB::table('appointments')
            ->join('slots', 'appointments.slot_id', '=', 'slots.id')
            ->whereIn('appointments.status', ['CONFIRME', 'TERMINE', 'ABSENT']);

        if ($startDate) {
            $chartQuery->where('slots.date_consultation', '>=', $startDate);
        }

        $dateFormatGroup = in_array($period, ['1y', 'all']) ? '%Y-%m' : '%Y-%m-%d';
        $dateFormatLabel = in_array($period, ['1y', 'all']) ? '%b %Y' : '%d %b';

        $chartData = $chartQuery
            ->select(
                DB::raw("DATE_FORMAT(slots.date_consultation, '{$dateFormatGroup}') as date_group"),
                DB::raw("DATE_FORMAT(slots.date_consultation, '{$dateFormatLabel}') as label"),
                // Sommes conditionnelles selon les statuts
                DB::raw("SUM(CASE WHEN appointments.status = 'TERMINE' THEN 1 ELSE 0 END) as honores"),
                DB::raw("SUM(CASE WHEN appointments.status = 'CONFIRME' THEN 1 ELSE 0 END) as confirmes"),
                DB::raw("SUM(CASE WHEN appointments.status = 'ABSENT' THEN 1 ELSE 0 END) as absents")
            )
            ->groupBy('date_group', 'label')
            ->orderBy('date_group', 'ASC')
            ->get();


        // 5. Autres compteurs
        $totalDoctors = Doctor::count();
        $activeDoctors = Doctor::where('status', 'actif')->count();
        $totalSpecialities = Speciality::count();
        $totalPatients = User::where('role', 'patient')->count();

        return response()->json([
            'status' => 'success',
            'data' => [
                'confirmed_appointments' => $confirmedCount,
                'total_revenue'          => (int) $totalRevenue,
                'chart_data'             => $chartData,
                'total_doctors'          => $totalDoctors,
                'active_doctors'         => $activeDoctors,
                'total_specialities'     => $totalSpecialities,
                'total_patients'         => $totalPatients,
            ]
        ]);
    }

    /**
     * Modale : Liste détaillée des RDV confirmés
     */
    public function getConfirmedDetails(Request $request): JsonResponse
    {
        $period = $request->query('period', '7d');
        $startDate = $this->getStartDate($period);

        $query = Appointment::with([
            'patient:id,nom,prenom',
            'slot.doctor.speciality'
        ])
            ->whereIn('status', ['CONFIRME', 'TERMINE', 'ABSENT']);

        if ($startDate) {
            $query->whereHas('slot', function ($q) use ($startDate) {
                $q->where('date_consultation', '>=', $startDate);
            });
        }

        $appointments = $query->orderBy('id', 'DESC')->get();

        // Formatage clair pour le composant React
        $formattedData = $appointments->map(function ($app) {
            return [
                'id'               => $app->id,
                'status'           => $app->status,
                'amount_paid'      => $app->amount_to_pay,
                'appointment_date' => $app->slot ? $app->slot->date_consultation : 'N/C',
                'time_slot'        => $app->slot ? $app->slot->start_time . ' - ' . $app->slot->end_time : '',
                'patient'          => $app->patient,
                'doctor'           => $app->slot?->doctor,
                'speciality'       => $app->slot?->doctor?->speciality,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data'   => $formattedData
        ]);
    }

    /**
     * Spécialités
     */
    public function getSpecialities(): JsonResponse
    {
        try {
            $specialities = Speciality::withCount('doctors')->get();
            return response()->json(['success' => true, 'data' => $specialities], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function storeSpeciality(Request $request): JsonResponse
    {
        $request->validate([
            'nom'                => 'required|string|max:100|unique:specialities,nom',
            'duree_consultation' => 'required|integer|min:5|max:180',
            'tarif'              => 'required|integer|min:0',
        ]);

        try {
            $speciality = Speciality::create([
                'nom'                => $request->nom,
                'duree_consultation' => $request->duree_consultation,
                'tarif'              => $request->tarif,
                'is_active'          => 1,
            ]);

            return response()->json(['success' => true, 'data' => $speciality], 201);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function updateSpeciality(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'nom'                => 'required|string|max:100|unique:specialities,nom,' . $id,
            'duree_consultation' => 'required|integer|min:5|max:180',
            'tarif'              => 'required|integer|min:0',
            'is_active'          => 'boolean',
        ]);

        try {
            $speciality = Speciality::findOrFail($id);
            $speciality->update([
                'nom'                => $request->nom,
                'duree_consultation' => $request->duree_consultation,
                'tarif'              => $request->tarif,
                'is_active'          => $request->has('is_active') ? $request->is_active : $speciality->is_active,
            ]);

            return response()->json(['success' => true, 'data' => $speciality], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function destroySpeciality(int $id): JsonResponse
    {
        try {
            $speciality = Speciality::withCount('doctors')->findOrFail($id);

            if ($speciality->doctors_count > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Impossible de supprimer cette spécialité : des médecins y sont toujours rattachés.'
                ], 422);
            }

            $speciality->delete();
            return response()->json(['success' => true, 'message' => 'Spécialité supprimée avec succès.'], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Médecins
     */
    public function getDoctors(): JsonResponse
    {
        try {
            $doctors = Doctor::with('speciality')->get();
            return response()->json(['success' => true, 'data' => $doctors], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function storeDoctor(Request $request): JsonResponse
    {
        $request->validate([
            'nom'           => 'required|string|max:100',
            'prenom'        => 'required|string|max:100',
            'speciality_id' => 'required|exists:specialities,id',
        ]);

        try {
            $doctor = Doctor::create([
                'nom'           => $request->nom,
                'prenom'        => $request->prenom,
                'speciality_id' => $request->speciality_id,
                'status'        => 'actif',
            ]);

            return response()->json(['success' => true, 'data' => $doctor->load('speciality')], 201);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function toggleDoctorStatus(int $id): JsonResponse
    {
        try {
            $doctor = Doctor::findOrFail($id);
            $doctor->status = ($doctor->status === 'actif') ? 'inactif' : 'actif';
            $doctor->save();

            return response()->json(['success' => true, 'data' => $doctor], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Absences Médecins (doctor_unavailabilities)
     */
    public function getUnavailabilities(): JsonResponse
    {
        try {
            $unavailabilities = DoctorUnavailability::with(['doctor', 'creator'])
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json(['success' => true, 'data' => $unavailabilities], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Gestion Comptes Users
     */
    public function getUsersLogs(): JsonResponse
    {
        try {
            $users = User::select('id', 'keycloak_uuid', 'nom', 'prenom', 'email', 'telephone', 'role', 'created_at')
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json(['success' => true, 'data' => $users], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Créer un utilisateur staff (secrétaire ou admin) - Version complète
     */
    public function storeStaffUser(Request $request): JsonResponse
    {
        $request->validate([
            'nom'       => 'required|string|max:100',
            'prenom'    => 'required|string|max:100',
            'email'     => 'required|email|max:150|unique:users,email',
            'telephone' => 'nullable|string|max:30',
            'role'      => 'required|in:secretaire,administrateur',
            'password'  => 'required|string|min:8',
        ]);

        DB::beginTransaction();

        try {
            // 1. Récupérer un token d'administration Keycloak
            $tokenResponse = Http::asForm()->post(env('KEYCLOAK_BASE_URL') . '/realms/' . env('KEYCLOAK_REALM') . '/protocol/openid-connect/token', [
                'client_id'     => 'admin-cli',
                'client_secret' => env('KEYCLOAK_ADMIN_CLIENT_SECRET'),
                'grant_type'    => 'client_credentials',
            ]);

            if (!$tokenResponse->successful()) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Impossible de s\'authentifier auprès de Keycloak Admin.',
                    'debug'   => $tokenResponse->body()
                ], 500);
            }

            $adminToken = $tokenResponse->json()['access_token'];
            $baseUrl = env('KEYCLOAK_BASE_URL') . '/admin/realms/' . env('KEYCLOAK_REALM');

            // 2. Créer l'utilisateur dans Keycloak
            $createUserResponse = Http::withToken($adminToken)->post($baseUrl . "/users", [
                'username'      => $request->email,
                'email'         => $request->email,
                'firstName'     => $request->prenom,
                'lastName'      => $request->nom,
                'enabled'       => true,
                'emailVerified' => true,
                'credentials'   => [
                    [
                        'type'      => 'password',
                        'value'     => $request->password,
                        'temporary' => true, // Mot de passe temporaire
                    ]
                ],
            ]);

            if ($createUserResponse->status() !== 201) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Erreur lors de la création Keycloak.',
                    'debug'   => $createUserResponse->body()
                ], 400);
            }

            // 3. Récupérer l'UUID Keycloak généré
            $locationHeader = $createUserResponse->header('Location');
            $keycloakUuid = last(explode('/', $locationHeader));

            // 4. Assigner le rôle dans Keycloak
            $roleName = $request->role === 'secretaire' ? 'secretary' : 'admin';

            // Récupérer le rôle
            $roleResponse = Http::withToken($adminToken)->get($baseUrl . "/roles/{$roleName}");

            if (!$roleResponse->successful()) {
                // Si le rôle n'existe pas, le créer
                Http::withToken($adminToken)->post($baseUrl . "/roles", [
                    'name'        => $roleName,
                    'description' => $roleName === 'admin' ? 'Administrateur' : 'Secrétaire',
                ]);

                // ✅ Récupérer le rôle nouvellement créé (car POST /roles ne renvoie pas d'objet)
                $roleResponse = Http::withToken($adminToken)->get($baseUrl . "/roles/{$roleName}");
            }

            if ($roleResponse->successful()) {
                $roleData = $roleResponse->json();
                Http::withToken($adminToken)->post($baseUrl . "/users/{$keycloakUuid}/role-mappings/realm", [
                    [
                        'id'   => $roleData['id'],
                        'name' => $roleData['name'],
                    ]
                ]);
            }

            // 5. Enregistrer en BDD MySQL locale
            $user = User::create([
                'keycloak_uuid'        => $keycloakUuid,
                'nom'                  => $request->nom,
                'prenom'               => $request->prenom,
                'email'                => $request->email,
                'telephone'            => $request->telephone,
                'role'                 => $request->role,
                'password'             => bcrypt($request->password),
                'keycloak_synced'      => true,
                'must_change_password' => true,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'data'    => $user,
                'message' => 'Utilisateur créé avec succès dans Keycloak et la base de données.'
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Erreur: ' . $e->getMessage()
            ], 500);
        }
    }
}
