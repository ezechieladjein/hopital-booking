import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initKeycloak } from './keycloak'

// 🚀 CODE MAGIQUE : Intercepteur pour sauter la sécurité Ngrok sur tous les fetchs
const originalFetch = window.fetch;
window.fetch = async function (...args) {
    if (args[1] === undefined) args[1] = {};
    if (args[1].headers === undefined) args[1].headers = {};
    
    if (args[1].headers instanceof Headers) {
        args[1].headers.set('ngrok-skip-browser-warning', 'true');
    } else {
        args[1].headers['ngrok-skip-browser-warning'] = 'true';
    }
    return originalFetch.apply(this, args);
};

const root = ReactDOM.createRoot(document.getElementById('root'));

// Fonction de secours si Keycloak plante ou n'appelle pas le callback
const renderApp = () => {
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
};

console.log("Démarrage de l'initialisation de Keycloak...");

try {
    // On tente d'initialiser Keycloak
    initKeycloak(() => {
        echo("Keycloak initialisé avec succès, chargement de l'application...");
        renderApp();
    });

    // SÉCURITÉ : Si après 4 secondes la page est toujours blanche (Keycloak bloqué)
    // On force l'affichage de l'application pour que tu puisses travailler en local
    setTimeout(() => {
        if (!window.keycloakAuthenticated) { 
            console.warn("⚠️ Keycloak met trop de temps à répondre. Passage en mode secours local.");
            renderApp();
        }
    }, 4000);

} catch (error) {
    console.error("Le chargement de Keycloak a crashé :", error);
    // En cas de crash total de l'init, on affiche quand même l'application
    renderApp();
}