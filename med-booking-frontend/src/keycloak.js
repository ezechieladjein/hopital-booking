import Keycloak from 'keycloak-js';

// Configuration dynamique avec la variable d'environnement de Vercel (Ngrok)
const keycloakConfig = {
    url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8085',
    realm: 'med-booking-realm',
    clientId: 'med-booking-front',
};

const keycloak = new Keycloak(keycloakConfig);

export const initKeycloak = (onAuthenticatedCallback) => {
    keycloak
        .init({
            onLoad: 'login-required', // Force la redirection vers Keycloak dès l'ouverture
            checkLoginIframe: false,   // Évite les soucis de cookies tiers en local
            redirectUri: window.location.origin, // 🚀 Force le retour sur Vercel après la connexion
        })
        .then((authenticated) => {
            if (authenticated) {
                console.log("Utilisateur authentifié avec succès !");
                onAuthenticatedCallback();
            } else {
                window.location.reload();
            }
        })
        .catch((error) => {
            console.error("Échec de l'initialisation de Keycloak :", error);
        });
};

export default keycloak;