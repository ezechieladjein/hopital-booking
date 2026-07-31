// src/keycloak-init.js
import Keycloak from 'keycloak-js';

const keycloakConfig = {
    url: '/keycloak',
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

const clearStoredTokens = () => {
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

    const token = hasAuthCodeInUrl ? null : sessionStorage.getItem('kc_token');
    const refreshToken = hasAuthCodeInUrl ? null : sessionStorage.getItem('kc_refreshToken');
    const idToken = hasAuthCodeInUrl ? null : sessionStorage.getItem('kc_idToken');

    const initOptions = {
        checkLoginIframe: false,
        pkceMethod: 'S256',
        redirectUri: window.location.origin,
    };

    if (token) {
        initOptions.token = token;
        initOptions.refreshToken = refreshToken || undefined;
        initOptions.idToken = idToken || undefined;
    } else if (!hasAuthCodeInUrl) {
        initOptions.onLoad = 'check-sso';
        initOptions.silentCheckSsoRedirectUri = window.location.origin + '/silent-check-sso.html';
    }

    initPromise = keycloak.init(initOptions)
    .then((auth) => {
        console.log(`✅ Keycloak initialisé, authentifié = ${auth}`);
        isInitialized = true;

        window.keycloak = keycloak;
        window.keycloakAuthenticated = auth;

        if (auth) {
            saveTokens(keycloak);

            keycloak.onTokenExpired = () => {
                console.log("🔄 Token expiré, rafraîchissement...");
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
        console.error("❌ Erreur d'initialisation Keycloak:", err);
        clearStoredTokens();
        initPromise = null;
        return false;
    });

    return initPromise;
};

export const login = () => {
    const keycloak = getKeycloak();
    clearStoredTokens();
    keycloak.login({
        redirectUri: window.location.origin,
        prompt: 'login' 
    });
};

export const logout = () => {
    const keycloak = getKeycloak();
    clearStoredTokens();
    window.keycloak = null;
    window.keycloakAuthenticated = false;
    keycloak.logout({
        redirectUri: window.location.origin
    });
};

const keycloak = getKeycloak();
export default keycloak;