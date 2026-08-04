<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Bienvenue sur Medigo</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f6f9; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 30px; border: 1px solid #e0e0e0;">
        <h2 style="color: #0D1B3D;">Bienvenue dans l'équipe, {{ $user->prenom }} !</h2>
        <p>Un compte <strong>{{ ucfirst($user->role) }}</strong> a été créé pour vous sur la plateforme Medigo.</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #2EAF5E; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Identifiant :</strong> {{ $user->email }}</p>
            <p style="margin: 5px 0 0 0;"><strong>Mot de passe temporaire :</strong> <code>{{ $temporaryPassword }}</code></p>
        </div>

        <p>Lors de votre première connexion, il vous sera demandé de modifier ce mot de passe pour des raisons de sécurité.</p>
    </div>
</body>
</html>