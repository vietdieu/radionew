import React, { useState } from "react";
import { User, LogOut, Cloud, CloudOff, CloudLightning, RefreshCw, Key } from "lucide-react";
import { getSupabaseClientAsync } from "../services/supabaseClient";
import { SyncStatus } from "../hooks/useSync";
import LoginModal from "./LoginModal";

interface UserProfileProps {
  user: any;
  syncStatus: SyncStatus;
  isOnline: boolean;
  onSync: () => void;
  uiLanguage: "vi" | "en";
}

const uDict = {
  vi: {
    signInBtn: "Đồng bộ Cloud",
    signOutBtn: "Đăng xuất",
    syncStatusLabel: "Đồng bộ",
    synced: "Đã đồng bộ",
    syncing: "Đang đồng bộ...",
    offline: "Ngoại tuyến (Offline)",
    error: "Lỗi đồng bộ",
    unauthenticated: "Chưa đăng nhập",
    greeting: "Xin chào",
    syncNow: "Đồng bộ ngay"
  },
  en: {
    signInBtn: "Cloud Sync",
    signOutBtn: "Sign Out",
    syncStatusLabel: "Sync",
    synced: "Synced",
    syncing: "Syncing...",
    offline: "Offline",
    error: "Sync error",
    unauthenticated: "Unauthenticated",
    greeting: "Hello",
    syncNow: "Sync Now"
  }
};

export default function UserProfile({
  user,
  syncStatus,
  isOnline,
  onSync,
  uiLanguage
}: UserProfileProps) {
  const u = uDict[uiLanguage];
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = await getSupabaseClientAsync();
    if (supabase) {
      await supabase.auth.signOut();
      setDropdownOpen(false);
    }
  };

  const getSyncIcon = () => {
    switch (syncStatus) {
      case "synced":
        return <Cloud className="w-4 h-4 text-emerald-400" />;
      case "syncing":
        return <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />;
      case "offline":
        return <CloudOff className="w-4 h-4 text-slate-500" />;
      case "error":
        return <CloudLightning className="w-4 h-4 text-rose-400 animate-bounce" />;
      default:
        return <CloudOff className="w-4 h-4 text-slate-600" />;
    }
  };

  const getSyncBg = () => {
    switch (syncStatus) {
      case "synced":
        return "bg-emerald-950/40 border border-emerald-800/60 text-emerald-300";
      case "syncing":
        return "bg-cyan-950/40 border border-cyan-800/60 text-cyan-300";
      case "offline":
        return "bg-slate-900 border border-slate-800 text-slate-400";
      case "error":
        return "bg-rose-950/40 border border-rose-800/60 text-rose-300";
      default:
        return "bg-slate-900 border border-slate-800 text-slate-500";
    }
  };

  return (
    <div className="relative font-sans" id="user-profile-widget">
      {user ? (
        <div className="flex items-center gap-2">
          {/* Status Capsule Indicator */}
          <button
            onClick={() => onSync()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 ${getSyncBg()}`}
            title={u.syncNow}
          >
            {getSyncIcon()}
            <span className="hidden sm:inline">{u[syncStatus]}</span>
          </button>

          {/* User Button */}
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-500 transition cursor-pointer"
          >
            <User className="w-4 h-4" />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 top-11 bg-slate-900 border border-slate-800 rounded-2xl w-56 py-2 shadow-2xl z-50 animate-fade-in text-xs text-slate-300">
                <div className="px-4 py-2 border-b border-slate-800">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{u.greeting}</p>
                  <p className="font-bold text-white truncate mt-0.5" title={user.email}>{user.email}</p>
                </div>
                
                <button
                  onClick={() => { onSync(); setDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-800 flex items-center gap-2.5 transition cursor-pointer font-medium text-slate-200"
                >
                  <RefreshCw className="w-4 h-4 text-cyan-400" />
                  <span>{u.syncNow}</span>
                </button>

                <button
                  onClick={() => handleSignOut()}
                  className="w-full text-left px-4 py-2.5 hover:bg-rose-950/30 text-rose-400 hover:text-rose-300 flex items-center gap-2.5 transition cursor-pointer font-bold border-t border-slate-800"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{u.signOutBtn}</span>
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsLoginOpen(true)}
          className="bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg active:scale-95"
        >
          <Key className="w-3.5 h-3.5 text-cyan-400" />
          <span>{u.signInBtn}</span>
        </button>
      )}

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        uiLanguage={uiLanguage}
      />
    </div>
  );
}
