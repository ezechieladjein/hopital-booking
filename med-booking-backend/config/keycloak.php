<?php

return [
    'base_url' => env('KEYCLOAK_BASE_URL', 'http://localhost:8085'),
    'realm' => env('KEYCLOAK_REALM', 'med-booking-realm'),
    'client_id' => env('KEYCLOAK_CLIENT_ID', 'med-booking-front'),
    'client_secret' => env('KEYCLOAK_CLIENT_SECRET', ''),
    'redirect_uri' => env('KEYCLOAK_REDIRECT_URI', 'http://localhost:5173/callback'),
    'admin_client_id' => env('KEYCLOAK_ADMIN_CLIENT_ID', 'admin-cli'),
    'admin_client_secret' => env('KEYCLOAK_ADMIN_CLIENT_SECRET', ''),
];