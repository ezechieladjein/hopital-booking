// src/keycloak-init.js
import Keycloak from 'keycloak-js';

const keycloakConfig = {
    /*url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8085',*/
    url: window.location.origin + '/keycloak',
    realm: 'med-booking-realm',
    clientId: 'med-booking-front',
};

let keycloakInstance = null;
let initPromise = null;
let isInitialized = false;

export const getKeycloak = () => {
    if (!keycloakInstance) {
        keycloakInstance = new Keycloak(keycloakConfig);
    }
    return keycloakInstance;
};

export const clearStoredTokens = () => {
    sessionStorage.removeItem('kc_token');
    sessionStorage.removeItem('kc_refreshToken');
    sessionStorage.removeItem('kc_idToken');
};

const saveTokens = (keycloak) => {
    if (keycloak.token) sessionStorage.setItem('kc_token', keycloak.token);
    if (keycloak.refreshToken) sessionStorage.setItem('kc_refreshToken', keycloak.refreshToken);
    if (keycloak.idToken) sessionStorage.setItem('kc_idToken', keycloak.idToken);
};

export const initKeycloak = () => {
    if (isInitialized && keycloakInstance) {
        return Promise.resolve(keycloakInstance.authenticated);
    }

    if (initPromise) {
        return initPromise;
    }

    const keycloak = getKeycloak();

    const hasAuthCodeInUrl = window.location.search.includes('code=') || 
                             window.location.hash.includes('code=') ||
                             window.location.search.includes('state=');

    const token = sessionStorage.getItem('kc_token');
    const refreshToken = sessionStorage.getItem('kc_refreshToken');
    const idToken = sessionStorage.getItem('kc_idToken');

    const initOptions = {
        // CHANGEMENT : login-required au lieu de check-sso
        onLoad: 'check-sso',
        checkLoginIframe: false,
        pkceMethod: 'S256',
        redirectUri: window.location.origin + '/',
        silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
    };

    if (token && !hasAuthCodeInUrl) {
        initOptions.token = token;
        initOptions.refreshToken = refreshToken || undefined;
        initOptions.idToken = idToken || undefined;
    }

    initPromise = keycloak.init(initOptions)
    .then((auth) => {
        console.log(`Keycloak initialisé, authentifié = ${auth}`);
        isInitialized = true;

        window.keycloak = keycloak;
        window.keycloakAuthenticated = auth;

        if (auth) {
            saveTokens(keycloak);

            if (hasAuthCodeInUrl) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            keycloak.onTokenExpired = () => {
                console.log("Token expiré, rafraîchissement...");
                keycloak.updateToken(30).then((refreshed) => {
                    if (refreshed) {
                        saveTokens(keycloak);
                    }
                }).catch(() => {
                    clearStoredTokens();
                    keycloak.clearToken();
                });
            };
        } else {
            clearStoredTokens();
        }

        return auth;
    })
    .catch((err) => {
        console.error("Erreur d'initialisation Keycloak:", err);
        clearStoredTokens();
        initPromise = null;
        return false;
    });

    return initPromise;
};

export const login = () => {
    const keycloak = getKeycloak();
    clearStoredTokens();
    // CHANGEMENT : prompt: 'select_account' pour choisir le compte
    keycloak.login({
        redirectUri: window.location.origin + '/',
        prompt: 'select_account'
    });
};

export const logout = () => {
    const keycloak = getKeycloak();
    clearStoredTokens();
    window.keycloak = null;
    window.keycloakAuthenticated = false;
    
    keycloak.logout({
        redirectUri: window.location.origin + '/'
    });
};

const keycloak = getKeycloak();
export default keycloak;