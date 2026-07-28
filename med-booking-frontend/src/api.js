// src/api.js
import keycloak from './keycloak-init';

const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Récupère les headers avec le token Keycloak
 */
export const getAuthHeaders = () => {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${keycloak.token}`,
    };
};

/**
 * Fonction générique pour les appels API authentifiés
 */
export const apiFetch = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultOptions = {
        headers: getAuthHeaders(),
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers,
        },
    };

    try {
        const response = await fetch(url, mergedOptions);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `Erreur HTTP ${response.status}`);
        }
        
        return response.json();
    } catch (error) {
        console.error('❌ API Error:', error);
        throw error;
    }
};