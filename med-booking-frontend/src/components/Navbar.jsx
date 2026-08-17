// src/components/Navbar.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  RefreshCw,
  LogOut,
  User,
  ChevronDown,
  Bell,
  Shield,
  UserCheck,
  Sun,
  Moon,
  Mail,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CreditCard
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Navbar({ keycloak, primaryRole, onRefresh, isRefreshing, onLogout }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  const { darkMode, toggleDarkMode } = useTheme();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);

  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  const tokenParsed = keycloak?.tokenParsed || {};
  const userUuid = tokenParsed.sub;
  const firstName = tokenParsed.given_name || '';
  const lastName = tokenParsed.family_name || '';
  const fullName = `${firstName} ${lastName}`.trim() || tokenParsed.preferred_username || 'Utilisateur';
  const email = tokenParsed.email || 'Non renseigné';

  const fetchNotifications = async () => {
    if (!userUuid) return;
    setIsLoadingNotifs(true);
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
        setUnreadCount(resData.unread_count);
      }
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
    } finally {
      setIsLoadingNotifs(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [userUuid, isRefreshing]);

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
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
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Erreur marquage notifications:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roleConfig = {
    admin: { label: 'Administrateur', color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300', icon: Shield },
    secretary: { label: 'Secrétaire', color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300', icon: UserCheck },
    patient: { label: 'Patient', color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300', icon: User },
  };

  const currentRole = roleConfig[primaryRole] || { label: 'Utilisateur', color: 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300', icon: User };
  const RoleIcon = currentRole.icon;

  const getNotifIcon = (type) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'appointment': return <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'payment': return <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'alert': return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default: return <Bell className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />;
    }
  };

  return (
    <nav className={`bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 px-6 py-3 sticky top-0 z-50 transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto flex justify-between items-center">

        {/* LOGO */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0D1B3D] dark:bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md">
            M
          </div>
          <div>
            <span className="text-2xl font-black text-[#0D1B3D] dark:text-white tracking-tight">
              Medi<span className="text-[#2EAF5E] dark:text-emerald-400">Go</span>
            </span>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* BOUTON REFRESH */}
          <button
            onClick={onRefresh}
            title="Rafraîchir les données"
            className={`p-2.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-2 cursor-pointer ${
              darkMode 
                ? 'bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200 border-neutral-700 hover:border-neutral-600' 
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
            <span className="hidden md:inline">Actualiser</span>
          </button>

          {/* TOGGLE THEME */}
          <button
            onClick={toggleDarkMode}
            title={darkMode ? "Mode clair" : "Mode sombre"}
            className={`p-2.5 rounded-xl border transition cursor-pointer ${
              darkMode 
                ? 'bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200 border-neutral-700 hover:border-neutral-600' 
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
            }`}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* DROPDOWN NOTIFICATIONS */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              title="Notifications"
              className={`p-2.5 rounded-xl border relative transition cursor-pointer ${
                darkMode 
                  ? 'bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-200 border-neutral-700 hover:border-neutral-600' 
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
              }`}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-neutral-900 animate-pulse"></span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className={`absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl shadow-2xl border py-3 z-50 ${
                darkMode 
                  ? 'bg-neutral-900 border-neutral-700' 
                  : 'bg-white border-gray-100'
              }`}>
                <div className={`px-4 pb-3 border-b flex justify-between items-center ${darkMode ? 'border-neutral-700' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <h3 className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>Notifications & Mails</h3>
                    {unreadCount > 0 && (
                      <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {unreadCount} non lu(s)
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                    >
                      Tout marquer comme lu
                    </button>
                  )}
                </div>

                <div className={`max-h-72 overflow-y-auto divide-y ${darkMode ? 'divide-neutral-800' : 'divide-gray-50'}`}>
                  {isLoadingNotifs ? (
                    <div className={`p-4 text-center text-xs ${darkMode ? 'text-neutral-400' : 'text-gray-400'}`}>Chargement...</div>
                  ) : notifications.length === 0 ? (
                    <div className={`p-6 text-center text-xs ${darkMode ? 'text-neutral-400' : 'text-gray-400'}`}>Aucune notification pour le moment</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3.5 transition flex items-start gap-3 ${!n.read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''} ${darkMode ? 'hover:bg-neutral-800/50' : 'hover:bg-gray-50'}`}
                      >
                        <div className={`p-2 rounded-lg mt-0.5 ${darkMode ? 'bg-neutral-800' : 'bg-gray-100'}`}>
                          {getNotifIcon(n.type)}
                        </div>
                        <div className="flex-1">
                          <p className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{n.title}</p>
                          <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-neutral-400' : 'text-gray-500'}`}>{n.message}</p>
                          <span className={`text-[10px] flex items-center gap-1 mt-1 ${darkMode ? 'text-neutral-500' : 'text-gray-400'}`}>
                            <Clock className="w-3 h-3" /> {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className={`p-2 border-t text-center ${darkMode ? 'border-neutral-700' : 'border-gray-100'}`}>
                  <button
                    onClick={() => {
                      setIsNotificationsOpen(false);
                      window.location.href = '/patient/notifications';
                    }}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Voir toutes les notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={`h-6 w-px mx-1 ${darkMode ? 'bg-neutral-700' : 'bg-gray-200'}`}></div>

          {/* DROPDOWN PROFIL */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`flex items-center gap-2.5 p-1.5 rounded-xl transition cursor-pointer ${darkMode ? 'hover:bg-neutral-800' : 'hover:bg-gray-50'}`}
            >
              <div className="w-9 h-9 rounded-xl bg-[#0D1B3D] dark:bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                {firstName ? `${firstName[0]}${lastName[0] || ''}`.toUpperCase() : 'U'}
              </div>
              <div className="text-left hidden md:block">
                <p className={`text-xs font-bold leading-none mb-1 ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>{fullName}</p>
                <p className={`text-[11px] leading-none ${darkMode ? 'text-neutral-400' : 'text-gray-400'}`}>{email}</p>
              </div>
              <ChevronDown className={`w-4 h-4 ${darkMode ? 'text-neutral-400' : 'text-gray-400'} transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className={`absolute right-0 mt-3 w-64 rounded-2xl shadow-2xl border py-2 z-50 ${
                darkMode 
                  ? 'bg-neutral-900 border-neutral-700' 
                  : 'bg-white border-gray-100'
              }`}>
                <div className={`px-4 py-3 border-b ${darkMode ? 'border-neutral-700' : 'border-gray-100'}`}>
                  <p className={`text-xs font-medium ${darkMode ? 'text-neutral-400' : 'text-gray-400'}`}>Compte connecté</p>
                  <p className={`text-sm font-bold truncate ${darkMode ? 'text-white' : 'text-[#0D1B3D]'}`}>{fullName}</p>
                  <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${currentRole.color}`}>
                    <RoleIcon className="w-3.5 h-3.5" />
                    <span>{currentRole.label}</span>
                  </div>
                </div>

                <div className="p-1.5">
                  <button
                    onClick={onLogout}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl transition cursor-pointer ${
                      darkMode 
                        ? 'text-red-400 hover:bg-red-950/40' 
                        : 'text-red-600 hover:bg-red-50'
                    }`}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Se déconnecter</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}