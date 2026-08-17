<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\PatientAssurance;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Exception;

class PatientInsuranceController extends Controller
{
    /**
     * Récupérer la liste des assurances enregistrées d'un patient.
     */
    public function index(string $keycloakUuid): JsonResponse
    {
        try {
            $user = User::where('keycloak_uuid', $keycloakUuid)->firstOrFail();
            $insurances = PatientAssurance::where('patient_id', $user->id)
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $insurances
            ], 200);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la récupération des assurances : ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Enregistrer une nouvelle assurance patient (avec upload de document).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'keycloak_uuid'  => 'required|string|exists:users,keycloak_uuid',
            'insurance_name' => 'required|string|max:255',
            'policy_number'  => 'required|string|max:255',
            'document'       => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120', // Max 5Mo
        ]);

        try {
            $user = User::where('keycloak_uuid', $validated['keycloak_uuid'])->firstOrFail();

            $documentUrl = null;
            if ($request->hasFile('document')) {
                // Stockage dans storage/app/public/insurances/
                $path = $request->file('document')->store('insurances', 'public');
                $documentUrl = Storage::url($path);
            }

            $insurance = PatientAssurance::create([
                'patient_id'     => $user->id,
                'insurance_name' => $validated['insurance_name'],
                'policy_number'  => $validated['policy_number'],
                'document_path'  => $documentUrl,
                'is_active'      => true,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Assurance enregistrée avec succès.',
                'data'    => $insurance
            ], 201);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la sauvegarde : ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Supprimer une assurance enregistrée.
     */
    public function destroy(int $id): JsonResponse
    {
        try {
            $insurance = PatientAssurance::findOrFail($id);

            // Supprimer le fichier du disque 'public' s'il existe
            if ($insurance->document_path) {
                $relativePath = str_replace('/storage/', '', $insurance->document_path);
                Storage::disk('public')->delete($relativePath);
            }

            $insurance->delete();

            return response()->json([
                'success' => true,
                'message' => 'Assurance supprimée avec succès.'
            ], 200);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur de suppression : ' . $e->getMessage()
            ], 500);
        }
    }
}