import React, { useEffect } from "react";
import { Cloud, CloudOff, CloudLightning, RefreshCw, AlertCircle, CheckCircle, Play } from "lucide-react";
import { useSync } from "../hooks/useSync";

interface SyncStatusProps {
  uiLanguage?: "vi" | "en";
}

const statusDict = {
  vi: {
    synced: "Đã đồng bộ",
    syncing: "Đang đồng bộ...",
    offline: "Ngoại tuyến (Offline)",
    error: "Lỗi đồng bộ",
    unauthenticated: "Đăng nhập để đồng bộ",
    pending: "chờ đồng bộ",
    syncNow: "Đồng bộ ngay",
    retry: "Thử lại",
    latest: "Vừa xong"
  },
  en: {
    synced: "Synced",
    syncing: "Syncing...",
    offline: "Offline",
    error: "Sync error",
    unauthenticated: "Sign in to sync",
    pending: "pending",
    syncNow: "Sync Now",
    retry: "Retry",
    latest: "Just now"
  }
};

export function SyncStatus({ uiLanguage = "vi" }: SyncStatusProps) {
  const { 
    user, 
    syncStatus, 
    isOnline, 
    queueLength, 
    triggerSync, 
    updateQueueLength 
  } = useSync();

  const dict = statusDict[uiLanguage === "vi" ? "vi" : "en"];

  // Cập nhật số lượng hàng đợi khi component mount hoặc khi trạng thái đồng bộ thay đổi
  useEffect(() => {
    updateQueueLength();
  }, [syncStatus, updateQueueLength]);

  if (!user) {
    return null; // Không hiển thị nếu chưa đăng nhập
  }

  const getStatusContent = () => {
    if (!isOnline) {
      return {
        icon: <CloudOff className="w-4 h-4 text-slate-400" />,
        text: dict.offline,
        bg: "bg-slate-900 border border-slate-800 text-slate-400",
        actionBtn: null
      };
    }

    switch (syncStatus) {
      case "syncing":
        return {
          icon: <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />,
          text: queueLength > 0 ? `${dict.syncing} (${queueLength} ${dict.pending})` : dict.syncing,
          bg: "bg-cyan-950/40 border border-cyan-800/60 text-cyan-300",
          actionBtn: null
        };
      case "error":
        return {
          icon: <CloudLightning className="w-4 h-4 text-rose-400 animate-pulse" />,
          text: dict.error,
          bg: "bg-rose-950/40 border border-rose-800/60 text-rose-300",
          actionBtn: (
            <button
              onClick={triggerSync}
              className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              {dict.retry}
            </button>
          )
        };
      case "synced":
      default:
        return {
          icon: queueLength > 0 ? (
            <RefreshCw className="w-4 h-4 text-amber-400 animate-pulse" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          ),
          text: queueLength > 0 
            ? `${queueLength} ${dict.pending}` 
            : dict.synced,
          bg: queueLength > 0 
            ? "bg-amber-950/40 border border-amber-800/60 text-amber-300"
            : "bg-emerald-950/40 border border-emerald-800/60 text-emerald-300",
          actionBtn: (
            <button
              onClick={triggerSync}
              className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                queueLength > 0 
                  ? "bg-amber-500 hover:bg-amber-600 text-slate-950" 
                  : "bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 border border-slate-700"
              }`}
            >
              {dict.syncNow}
            </button>
          )
        };
    }
  };

  const status = getStatusContent();

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-all duration-300 shadow-md ${status.bg}`}
      id="sync-status-indicator"
    >
      <div className="flex items-center gap-1.5">
        {status.icon}
        <span className="font-sans leading-none">{status.text}</span>
      </div>
      {status.actionBtn}
    </div>
  );
}

export default SyncStatus;
