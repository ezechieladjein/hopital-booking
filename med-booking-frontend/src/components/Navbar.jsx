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

export default function Navbar({ keycloak, primaryRole, onRefresh, isRefreshing, onLogout }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // État local des notifications
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

  // 1. Charger les notifications depuis l'API Laravel
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

  // Charger au montage & quand le bouton "Actualiser" global est cliqué
  useEffect(() => {
    fetchNotifications();
  }, [userUuid, isRefreshing]);

  // 2. Marquer toutes les notifications comme lues
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

  // 3. Gestion Mode Sombre / Clair
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // 4. Fermeture des menus au clic extérieur
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

  const currentRole = roleConfig[primaryRole] || { label: 'Utilisateur', color: 'bg-gray-100 text-gray-700', icon: User };
  const RoleIcon = currentRole.icon;

  // Icône adaptée selon le type de notification
  const getNotifIcon = (type) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4 text-purple-600" />;
      case 'appointment': return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
      case 'payment': return <CreditCard className="w-4 h-4 text-emerald-600" />;
      case 'alert': return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      default: return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <nav className="bg-white dark:bg-[#111827] border-b border-gray-200 dark:border-gray-800 px-6 py-3 sticky top-0 z-50 transition-colors duration-200">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        
        {/* LOGO */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0D1B3D] dark:bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md">
            M
          </div>
          <div>
            <span className="text-2xl font-black text-[#0D1B3D] dark:text-white tracking-tight">
              Medi<span className="text-[#2EAF5E]">Go</span>
            </span>
            {/* <span className="hidden sm:inline-block ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full">
              Medical Suite
            </span> */}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* BOUTON REFRESH */}
          <button
            onClick={onRefresh}
            title="Rafraîchir les données"
            className="p-2.5 sm:px-3.5 sm:py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold border border-gray-200 dark:border-gray-700 transition flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden md:inline">Actualiser</span>
          </button>

          {/* TOGGLE THEME */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? "Mode clair" : "Mode sombre"}
            className="p-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200 dark:border-gray-700 transition cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* DROPDOWN NOTIFICATIONS */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              title="Notifications"
              className="p-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl border border-gray-200 dark:border-gray-700 relative transition cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900 animate-pulse"></span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 py-3 z-50">
                <div className="px-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#0D1B3D] dark:text-white">Notifications & Mails</h3>
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

                <div className="max-h-72 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                  {isLoadingNotifs ? (
                    <div className="p-4 text-center text-xs text-gray-400">Chargement...</div>
                  ) : notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400">Aucune notification pour le moment</div>
                  ) : (
                    notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={`p-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition flex items-start gap-3 ${!n.read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}
                      >
                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 mt-0.5">
                          {getNotifIcon(n.type)}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{n.title}</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
                          <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" /> {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

          {/* DROPDOWN PROFIL */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-[#0D1B3D] dark:bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                {firstName ? `${firstName[0]}${lastName[0] || ''}`.toUpperCase() : 'U'}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold text-[#0D1B3D] dark:text-white leading-none mb-1">{fullName}</p>
                <p className="text-[11px] text-gray-400 leading-none">{email}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-400 font-medium">Compte connecté</p>
                  <p className="text-sm font-bold text-[#0D1B3D] dark:text-white truncate">{fullName}</p>
                  <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${currentRole.color}`}>
                    <RoleIcon className="w-3.5 h-3.5" />
                    <span>{currentRole.label}</span>
                  </div>
                </div>

                <div className="p-1.5">
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition cursor-pointer"
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