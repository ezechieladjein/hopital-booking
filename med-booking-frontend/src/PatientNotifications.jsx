// src/PatientNotifications.jsx
import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Mail, 
  CheckCircle2, 
  CreditCard, 
  AlertTriangle, 
  Clock, 
  CheckCheck, 
  Search, 
  Filter, 
  RefreshCw 
} from 'lucide-react';
import { useTheme } from './context/ThemeContext';

export default function PatientNotifications({ keycloak }) {
  const { darkMode } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const userUuid = keycloak?.tokenParsed?.sub;

  const fetchNotifications = async () => {
    if (!userUuid) return;
    setIsRefreshing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/notifications`, {
        headers: {
          'X-User-UUID': userUuid,
          'Accept': 'application/json',
        }
      });
      const resData = await response.json();
      if (resData.success) {
        setNotifications(resData.data);
      }
    } catch (error) {
      console.error("Erreur chargement des notifications:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [userUuid]);

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/notifications/mark-as-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-UUID': userUuid,
          'Accept': 'application/json',
        },
        body: JSON.stringify({ user_uuid: userUuid })
      });
      const resData = await response.json();
      if (resData.success) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (error) {
      console.error("Erreur lors du marquage des notifications:", error);
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'appointment':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
          bg: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
          label: 'Rendez-vous'
        };
      case 'payment':
        return {
          icon: <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
          bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
          label: 'Paiement'
        };
      case 'email':
        return {
          icon: <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
          bg: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
          label: 'Email'
        };
      case 'alert':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
          bg: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
          label: 'Alerte'
        };
      default:
        return {
          icon: <Bell className="w-4 h-4 text-gray-600 dark:text-gray-400" />,
          bg: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
          label: 'Information'
        };
    }
  };

  const filteredNotifications = notifications.filter(n => {
    const matchesType = activeFilter === 'all' || n.type === activeFilter;
    const matchesSearch = searchQuery === '' || 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      n.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const filterTabs = [
    { id: 'all', label: 'Toutes', count: notifications.length },
    { id: 'appointment', label: 'Rendez-vous', count: notifications.filter(n => n.type === 'appointment').length },
    { id: 'payment', label: 'Paiements', count: notifications.filter(n => n.type === 'payment').length },
    { id: 'email', label: 'Emails', count: notifications.filter(n => n.type === 'email').length },
    { id: 'alert', label: 'Alertes', count: notifications.filter(n => n.type === 'alert').length },
  ];

  return (
    <div className={`max-w-5xl mx-auto p-4 sm:p-6 space-y-6 ${darkMode ? 'text-gray-200' : ''}`}>
      
      {/* EN-TÊTE */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border shadow-xs ${
        darkMode 
          ? 'bg-[#1E293B] border-gray-800' 
          : 'bg-white border-gray-100'
      }`}>
        <div>
          <h1 className={`text-2xl font-black flex items-center gap-3 ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>
            <Bell className="w-7 h-7 text-blue-600" />
            Centre de Notifications
          </h1>
          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Consultez l'historique de vos confirmations de rendez-vous, reçus et messages.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchNotifications}
            disabled={isRefreshing}
            className={`p-2.5 hover:bg-gray-100 rounded-xl border transition flex items-center gap-2 text-xs font-bold cursor-pointer ${
              darkMode 
                ? 'bg-[#111827] text-gray-300 border-gray-700 hover:bg-gray-700' 
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Actualiser</span>
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Tout marquer comme lu ({unreadCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* RECHERCHE ET ONGLETS DE FILTRAGE */}
      <div className="space-y-4">
        
        {/* Barre de recherche */}
        <div className="relative">
          <Search className={`w-4 h-4 absolute left-4 top-3.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Rechercher dans les notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-11 pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
              darkMode 
                ? 'bg-[#1E293B] border-gray-700 text-gray-200' 
                : 'bg-white border-gray-200 text-gray-800'
            }`}
          />
        </div>

        {/* Onglets */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-[#0D1B3D] dark:bg-blue-600 text-white shadow-xs'
                  : darkMode
                    ? 'bg-[#1E293B] text-gray-400 border border-gray-700 hover:bg-gray-800'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeFilter === tab.id 
                  ? 'bg-white/20 text-white' 
                  : darkMode ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* LISTE DES NOTIFICATIONS */}
      <div className={`rounded-2xl border shadow-xs divide-y overflow-hidden ${
        darkMode 
          ? 'bg-[#1E293B] border-gray-800 divide-gray-800' 
          : 'bg-white border-gray-100 divide-gray-100'
      }`}>
        {loading ? (
          <div className={`p-12 text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            Chargement des notifications...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className={`w-10 h-10 mx-auto mb-3 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
            <p className={`text-sm font-bold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Aucune notification trouvée</p>
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Aucun message ne correspond à vos critères de recherche ou de filtre.</p>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const badge = getTypeBadge(n.type);
            return (
              <div
                key={n.id}
                className={`p-5 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  !n.read ? 'bg-blue-50/30 dark:bg-blue-950/20' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/40'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl mt-1 sm:mt-0 ${badge.bg}`}>
                    {badge.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>{n.title}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badge.bg}`}>
                        {badge.label}
                      </span>
                      {!n.read && (
                        <span className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                          NOUVEAU
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-1 leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{n.message}</p>
                    <div className={`flex items-center gap-3 text-[11px] mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(n.created_at).toLocaleDateString()} à {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}