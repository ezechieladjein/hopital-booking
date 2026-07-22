<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Speciality;
use App\Models\Doctor;
use App\Models\Appointment;
use App\Models\DoctorUnavailability;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;

class AdminController extends Controller
{
    /**
     * 1. Supervision & Statistiques
     */
    public function getStats(): JsonResponse
    {
        try {
            // Flux réel des RDV confirmés sur les 7 derniers jours
            $appointmentsPerDay = [];
            for ($i = 6; $i >= 0; $i--) {
                $date = Carbon::now()->subDays($i)->format('Y-m-d');
                $count = Appointment::where('status', 'CONFIRME')
                    ->whereDate('created_at', $date)
                    ->count();

                $appointmentsPerDay[] = [
                    'day' => Carbon::now()->subDays($i)->locale('fr')->minDayName,
                    'count' => $count
                ];
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'total_doctors'          => Doctor::count(),
                    'active_doctors'         => Doctor::where('status', 'actif')->count(),
                    'inactive_doctors'       => Doctor::where('status', 'inactif')->count(),
                    'total_specialities'     => Speciality::where('is_active', 1)->count(),
                    'confirmed_appointments' => Appointment::where('status', 'CONFIRME')->count(),
                    'total_patients'         => User::where('role', 'patient')->count(),
                    'weekly_appointments'    => $appointmentsPerDay
                ]
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * 2. Spécialités (Colonnes SQL : nom, duree_consultation, tarif, is_active)
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
     * 3. Médecins (Joins vers specialities)
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
     * 4. Absences Médecins (doctor_unavailabilities)
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
     * 5. Gestion Comptes Users (Table users clean)
     */
    public function getUsersLogs(): JsonResponse
    {
        try {
            $users = User::select('id', 'keycloak_uuid', 'nom', 'prenom', 'email', 'telephone', 'role', 'created_at', 'updated_at')
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json(['success' => true, 'data' => $users], 200);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function storeStaffUser(Request $request): JsonResponse
    {
        $request->validate([
            'nom'       => 'required|string|max:100',
            'prenom'    => 'required|string|max:100',
            'email'     => 'required|email|max:150|unique:users,email',
            'telephone' => 'nullable|string|max:30',
            'role'      => 'required|in:secretaire,administrateur',
        ]);

        try {
            $user = User::create([
                'nom'       => $request->nom,
                'prenom'    => $request->prenom,
                'email'     => $request->email,
                'telephone' => $request->telephone,
                'role'      => $request->role,
            ]);

            return response()->json(['success' => true, 'data' => $user], 201);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}