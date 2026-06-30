// src/features/pwa/PwaStatus.tsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, CloudOff, Wifi, CheckCircle2, RefreshCw } from "lucide-react";

export function PwaStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setToastMessage("Đã khôi phục kết nối mạng! / Connected to network!");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setToastMessage("Bạn đang ngoại tuyến. Một số tính năng nghe trực tiếp có thể bị hạn chế. / You are offline. Live streaming is limited.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check if running as standalone
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  return (
    <>
      {/* Toast Alert Banner */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className={`fixed bottom-20 left-4 right-4 sm:left-6 sm:right-auto z-[9999] max-w-md p-4 rounded-2xl shadow-xl flex items-center gap-3 border text-sm text-left ${
              isOnline
                ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/30"
                : "bg-amber-950/90 text-amber-300 border-amber-500/30"
            }`}
          >
            {isOnline ? <Wifi className="w-5 h-5 shrink-0" /> : <CloudOff className="w-5 h-5 shrink-0" />}
            <div>
              <p className="font-semibold">{isOnline ? "Đang trực tuyến / Online" : "Chế độ ngoại tuyến / Offline Mode"}</p>
              <p className="opacity-90">{toastMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA App Promo Module */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
        <div className="flex gap-3">
          <div className="p-2 bg-cyan-500/10 text-cyan-500 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm sm:text-base">
              Trạng thái PWA / PWA Status
            </h4>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">
              {isInstalled 
                ? "Ứng dụng đã được cài đặt thành công / App is installed and ready."
                : "Cài đặt để nghe Offline mượt mà hơn / Install for native offline access."}
            </p>
          </div>
        </div>

        {deferredPrompt && !isInstalled && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleInstallClick}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 dark:text-white rounded-xl text-xs sm:text-sm font-semibold shadow hover:brightness-115 transition"
            style={{ minHeight: "44px" }}
          >
            <Download className="w-4 h-4" />
            Cài đặt ứng dụng / Install App
          </motion.button>
        )}

        {isInstalled && (
          <div className="flex items-center gap-2 text-emerald-500 text-xs sm:text-sm font-medium">
            <Wifi className="w-4 h-4" />
            Hoạt động độc lập / Standalone Active
          </div>
        )}
      </div>
    </>
  );
}
