import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initKeycloak, login } from './keycloak-init'

// Intercepteur pour Ngrok
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

// Fonction de rendu de l'application
const renderApp = () => {
    console.log("🔄 Montage de l'application React...");
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
};

console.log("🚀 Démarrage de l'initialisation de Keycloak...");

// Initialiser Keycloak
initKeycloak()
    .then((authenticated) => {
        console.log(`✅ Keycloak initialisé, authentifié = ${authenticated}`);
        window.keycloakAuthenticated = authenticated;
        renderApp();
    })
    .catch((error) => {
        console.error("❌ Erreur d'initialisation Keycloak:", error);
        window.keycloakError = error.message;
        window._appRendered = true;
        
        // Afficher une page d'erreur avec bouton de connexion
        root.render(
            <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] p-6">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-200 max-w-md w-full text-center">
                    <div className="text-6xl mb-4">🔴</div>
                    <h2 className="text-xl font-bold text-red-600 mb-2">Erreur de connexion</h2>
                    <p className="text-sm text-gray-600 mb-4">
                        {error.message || "Impossible de se connecter à Keycloak"}
                    </p>
                    <div className="bg-gray-50 p-4 rounded-lg text-left text-xs text-gray-500 mb-4 overflow-auto max-h-40">
                        <p><strong>URL Keycloak:</strong> http://localhost:8085</p>
                        <p><strong>Realm:</strong> med-booking-realm</p>
                        <p><strong>Client:</strong> med-booking-front</p>
                        <p><strong>Origine:</strong> {window.location.origin}</p>
                    </div>
                    <div className="space-y-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-[#0D1B3D] text-white py-2.5 rounded-xl font-bold text-sm hover:bg-opacity-90 transition"
                        >
                            Réessayer
                        </button>
                        <button
                            onClick={() => {
                                console.log("🔐 Tentative de connexion manuelle...");
                                login();
                            }}
                            className="w-full bg-[#2EAF5E] text-white py-2.5 rounded-xl font-bold text-sm hover:bg-opacity-90 transition"
                        >
                            Se connecter manuellement
                        </button>
                    </div>
                </div>
            </div>
        );
    });

// Timeout de sécurité
setTimeout(() => {
    if (!window._appRendered) {
        console.warn("⚠️ Keycloak ne répond pas, affichage de l'application en mode dégradé...");
        window._appRendered = true;
        window.keycloakAuthenticated = false;
        renderApp();
    }
}, 10000);