// src/api.js
import keycloak from './keycloak-init';

const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Récupère les headers avec le token Keycloak
 * Rafraîchit automatiquement le token si nécessaire
 */
export const getAuthHeaders = async () => {
    // Vérifier si le token est encore valide ou le rafraîchir
    if (keycloak && keycloak.token) {
        try {
            const now = Math.floor(Date.now() / 1000);
            const tokenExp = keycloak.tokenParsed?.exp || 0;
            
            if (tokenExp - now < 10) {
                await keycloak.updateToken(30);
            }
        } catch (error) {
            console.error('Erreur rafraîchissement token:', error);
        }
    }

    const headers = {
        'Accept': 'application/json',
        'Authorization': `Bearer ${keycloak.token}`,
    };

    return headers;
};

/**
 * Fonction générique pour les appels API authentifiés
 */
export const apiFetch = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const isFormData = options.body instanceof FormData;

    const authHeaders = await getAuthHeaders();
    
    const headers = {
        ...authHeaders,
        ...options.headers,
    };
    
    if (isFormData) {
        delete headers['Content-Type'];
    } else if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const config = {
        ...options,
        headers,
    };

    try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `Erreur HTTP ${response.status}`);
        }
        
        return response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

/**
 * Effectue un appel API avec le token Keycloak pour des URLs complètes
 */
export const apiFetchWithToken = async (url, options = {}) => {
    const authHeaders = await getAuthHeaders();
    
    const headers = {
        ...authHeaders,
        ...options.headers,
    };
    
    const isFormData = options.body instanceof FormData;
    if (isFormData) {
        delete headers['Content-Type'];
    } else if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const config = {
        ...options,
        headers,
    };

    try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `Erreur HTTP ${response.status}`);
        }
        
        return response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};