// src/api.js
import keycloak from './keycloak-init';

export const fetchWithAuth = async (url, options = {}) => {
  // Rafraîchir le token s'il expire dans moins de 30 secondes
  if (keycloak.authenticated) {
    try {
      await keycloak.updateToken(30);
    } catch (error) {
      console.error("Session expirée, redirection vers Keycloak...", error);
      keycloak.login();
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${keycloak.token}`,
    ...options.headers,
  };

  return fetch(url, { ...options, headers });
};