<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class NotificationController extends Controller
{
    /**
     * Récupère les notifications de l'utilisateur connecté (via son UUID Keycloak)
     */
    public function index(Request $request): JsonResponse
    {
        $userUuid = $request->header('X-User-UUID') ?? $request->query('user_uuid');

        if (!$userUuid) {
            return response()->json(['success' => false, 'message' => 'UUID utilisateur requis'], 400);
        }

        $notifications = Notification::where('user_uuid', $userUuid)
            ->orderBy('created_at', 'desc')
            ->take(20)
            ->get();

        $unreadCount = Notification::where('user_uuid', $userUuid)
            ->where('read', false)
            ->count();

        return response()->json([
            'success'      => true,
            'unread_count' => $unreadCount,
            'data'         => $notifications
        ]);
    }

    /**
     * Marque toutes les notifications comme lues
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $userUuid = $request->header('X-User-UUID') ?? $request->input('user_uuid');

        if (!$userUuid) {
            return response()->json(['success' => false, 'message' => 'UUID utilisateur requis'], 400);
        }

        Notification::where('user_uuid', $userUuid)
            ->where('read', false)
            ->update(['read' => true]);

        return response()->json(['success' => true, 'message' => 'Notifications marquées comme lues']);
    }
}