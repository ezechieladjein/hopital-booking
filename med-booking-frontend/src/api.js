// src/api.js
import keycloak from './keycloak-init';

const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Récupère les headers avec le token Keycloak
 */
export const getAuthHeaders = () => {
    const headers = {
        'Accept': 'application/json',
    };

    if (keycloak && keycloak.token) {
        headers['Authorization'] = `Bearer ${keycloak.token}`;
    }

    return headers;
};

/**
 * Fonction générique pour les appels API authentifiés
 */
export const apiFetch = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const isFormData = options.body instanceof FormData;

    // Construction des headers
    const headers = {
        ...getAuthHeaders(),
        ...options.headers,
    };
    // Le navigateur doit le définir lui-même avec le boundary.
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