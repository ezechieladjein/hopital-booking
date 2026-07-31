// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

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

// Montage direct de l'application (App.jsx gère lui-même le loader et initKeycloak)
ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>
);