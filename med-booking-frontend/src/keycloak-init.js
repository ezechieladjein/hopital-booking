// src/keycloak-init.js
import Keycloak from 'keycloak-js';

 // Le clientId doit correspondre EXACTEMENT à celui dans Keycloak
const keycloakConfig = {
    /* url: 'http://localhost:8085', */
    url: '/keycloak',  // Utilise le proxy pour éviter les problèmes CORS
    realm: 'med-booking-realm',  // Vérifiez le nom exact de votre realm
    clientId: 'med-booking-front',  // Le nom exact de votre client
};

// Instance unique
let keycloakInstance = null;
let initPromise = null;
let isInitialized = false;

export const getKeycloak = () => {
    if (!keycloakInstance) {
        console.log("🔄 Création de l'instance Keycloak...");
        console.log("📋 Configuration:", keycloakConfig);
        keycloakInstance = new Keycloak(keycloakConfig);
    }
    return keycloakInstance;
};

export const initKeycloak = () => {
    if (isInitialized) {
        console.log("ℹ️ Keycloak déjà initialisé");
        return Promise.resolve(keycloakInstance.authenticated);
    }

    if (initPromise) {
        console.log("⏳ Initialisation en cours...");
        return initPromise;
    }

    const keycloak = getKeycloak();
    
    console.log("🚀 Lancement de l'initialisation Keycloak...");
    
    // ⚠️ Utiliser 'check-sso' pour vérifier sans forcer la redirection
    initPromise = keycloak.init({
        onLoad: 'check-sso',  // Changement ici
        checkLoginIframe: false,
        pkceMethod: 'S256',
        redirectUri: window.location.origin,
        silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
    })
    .then((auth) => {
        console.log(`✅ Keycloak initialisé, authentifié = ${auth}`);
        isInitialized = true;
        return auth;
    })
    .catch((err) => {
        console.error("❌ Erreur d'initialisation Keycloak:", err);
        initPromise = null;
        throw err;
    });

    return initPromise;
};

export const login = () => {
    const keycloak = getKeycloak();
    console.log("🔐 Redirection vers Keycloak...");
    try {
        keycloak.login({
            redirectUri: window.location.origin
        });
    } catch (error) {
        console.error("❌ Erreur lors de la redirection:", error);
        throw error;
    }
};

export const logout = () => {
    const keycloak = getKeycloak();
    keycloak.logout({ 
        redirectUri: window.location.origin 
    });
};

// Exporter l'instance
const keycloak = getKeycloak();
export default keycloak; 