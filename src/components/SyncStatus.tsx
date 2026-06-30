import React, { useEffect } from "react";
import { Cloud, CloudOff, CloudLightning, RefreshCw, AlertCircle, CheckCircle, Database } from "lucide-react";
import { useSync } from "../hooks/useSync";

interface SyncStatusProps {
  uiLanguage?: "vi" | "en";
}

const statusDict = {
  vi: {
    connected: "Đã kết nối đám mây",
    localOnly: "Lưu trữ nội bộ",
    offline: "Ngoại tuyến (Offline)",
    misconfigured: "Chưa cấu hình Cloud",
    syncing: "Đang đồng bộ...",
    syncNow: "Đồng bộ ngay",
    retry: "Thử lại",
    pending: "chờ",
    explainMisconfigured: "Vui lòng nhập cấu hình Supabase URL/Key trong môi trường cài đặt.",
    explainLocal: "Đang chạy mượt mà ở chế độ ngoại tuyến."
  },
  en: {
    connected: "Cloud Connected",
    localOnly: "Local Mode Only",
    offline: "Offline",
    misconfigured: "Cloud Misconfigured",
    syncing: "Syncing...",
    syncNow: "Sync Now",
    retry: "Retry",
    pending: "pending",
    explainMisconfigured: "Please set Supabase URL/Key environment variables to enable sync.",
    explainLocal: "Running smoothly on local database."
  }
};

export function SyncStatus({ uiLanguage = "vi" }: SyncStatusProps) {
  const { 
    user, 
    cloudStatus, 
    queueLength, 
    triggerSync, 
    updateQueueLength 
  } = useSync();

  const dict = statusDict[uiLanguage === "vi" ? "vi" : "en"];

  // Update pending queue count when mounted or cloudStatus changes
  useEffect(() => {
    updateQueueLength();
  }, [cloudStatus, updateQueueLength]);

  const getStatusContent = () => {
    switch (cloudStatus) {
      case "OFFLINE":
        return {
          icon: <CloudOff className="w-4 h-4 text-slate-400" />,
          text: dict.offline,
          bg: "bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400",
          actionBtn: null,
          title: dict.explainLocal
        };
      case "MISCONFIGURED":
        return {
          icon: <CloudLightning className="w-4 h-4 text-rose-500 animate-pulse" />,
          text: dict.misconfigured,
          bg: "bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400",
          actionBtn: null,
          title: dict.explainMisconfigured
        };
      case "SYNCING":
        return {
          icon: <RefreshCw className="w-4 h-4 text-cyan-500 animate-spin" />,
          text: queueLength > 0 ? `${dict.syncing} (${queueLength} ${dict.pending})` : dict.syncing,
          bg: "bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/50 text-cyan-600 dark:text-cyan-300",
          actionBtn: null,
          title: "Synchronization in progress"
        };
      case "CONNECTED":
        return {
          icon: queueLength > 0 ? (
            <RefreshCw className="w-4 h-4 text-amber-500 animate-pulse" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          ),
          text: queueLength > 0 
            ? `${queueLength} ${dict.pending}` 
            : dict.connected,
          bg: queueLength > 0 
            ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-300"
            : "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400",
          actionBtn: (
            <button
              onClick={triggerSync}
              className={`ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer ${
                queueLength > 0 
                  ? "bg-amber-500 hover:bg-amber-600 text-slate-950" 
                  : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              {dict.syncNow}
            </button>
          ),
          title: "Cloud Synced Successfully"
        };
      case "LOCAL_ONLY":
      default:
        return {
          icon: <Database className="w-4 h-4 text-amber-500" />,
          text: dict.localOnly,
          bg: "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400",
          actionBtn: user ? (
            <button
              onClick={triggerSync}
              className="ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer"
            >
              {dict.retry}
            </button>
          ) : null,
          title: dict.explainLocal
        };
    }
  };

  const status = getStatusContent();

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-medium transition-all duration-300 shadow-sm ${status.bg}`}
      id="sync-status-indicator"
      title={status.title}
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

