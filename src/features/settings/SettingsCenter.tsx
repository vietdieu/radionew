// src/features/settings/SettingsCenter.tsx
import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Settings, 
  Volume2, 
  Moon, 
  Sun, 
  Languages, 
  ShieldCheck, 
  BellRing, 
  Eye, 
  Activity, 
  SlidersHorizontal,
  FolderSync
} from "lucide-react";
import { 
  getFeatureSettings, 
  saveFeatureSettings, 
  getVoiceProfile, 
  getAccessibilityConfig, 
  FeatureSettings, 
  VoiceProfile, 
  AccessibilityConfig,
  clearPersonalMemory
} from "../store";
import { useUserPreferences, DefaultLanguage, PreferedVoice, ReadSpeed } from "../../components/UserPreferencesProvider";

interface SettingsCenterProps {
  uiLanguage?: "vi" | "en";
  onClearAllCache?: () => void;
}

export function SettingsCenter({ uiLanguage = "vi", onClearAllCache }: SettingsCenterProps) {
  const { preferences, updateVoice, updateLanguage, updateSpeed } = useUserPreferences();
  
  // Feature states loaded from centralized feature store
  const [featureSettings, setFeatureSettings] = useState<FeatureSettings>(getFeatureSettings());
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [clearedMemorySuccess, setClearedMemorySuccess] = useState(false);

  useEffect(() => {
    // Check dark mode state
    if (typeof document !== "undefined") {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    }
  }, []);

  const toggleTheme = () => {
    if (typeof document !== "undefined") {
      const isDark = document.documentElement.classList.toggle("dark");
      setIsDarkMode(isDark);
      try {
        localStorage.setItem("theme", isDark ? "dark" : "light");
      } catch {}
    }
  };

  const updateVoiceProfileValue = <K extends keyof VoiceProfile>(key: K, value: VoiceProfile[K]) => {
    const updatedProfile = { ...featureSettings.voiceProfile, [key]: value };
    const updatedSettings = { ...featureSettings, voiceProfile: updatedProfile };
    
    setFeatureSettings(updatedSettings);
    saveFeatureSettings(updatedSettings);

    // Sync with existing React state provider
    if (key === "vietnameseVoice" || key === "englishVoice") {
      const newVoice = (key === "vietnameseVoice" ? value : value) as PreferedVoice;
      updateVoice(newVoice);
    }
    if (key === "speed") {
      // Find nearest read speed limit in UserPreferencesProvider list
      updateSpeed(value as ReadSpeed);
    }
  };

  const updateAccessibilityValue = <K extends keyof AccessibilityConfig>(key: K, value: AccessibilityConfig[K]) => {
    const updatedAccessibility = { ...featureSettings.accessibility, [key]: value };
    const updatedSettings = { ...featureSettings, accessibility: updatedAccessibility };
    
    setFeatureSettings(updatedSettings);
    saveFeatureSettings(updatedSettings);
  };

  const updateGeneralSetting = <K extends keyof FeatureSettings>(key: K, value: FeatureSettings[K]) => {
    const updatedSettings = { ...featureSettings, [key]: value };
    setFeatureSettings(updatedSettings);
    saveFeatureSettings(updatedSettings);
  };

  const handleClearMemory = () => {
    clearPersonalMemory();
    setClearedMemorySuccess(true);
    setTimeout(() => setClearedMemorySuccess(false), 3000);
  };

  return (
    <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col text-left" id="settings-center-panel">
      <div className="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
        <Settings className="w-5 h-5 text-indigo-500" />
        <h3 className="font-bold text-slate-800 dark:text-slate-200">
          {uiLanguage === "vi" ? "Trung Tâm Cài Đặt" : "Control & Settings Center"}
        </h3>
      </div>

      <div className="space-y-6">
        {/* Playback & Voice profiles */}
        <section className="space-y-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-cyan-500" />
            <span>{uiLanguage === "vi" ? "Cấu hình giọng đọc AI" : "Voice & Playback Profiles"}</span>
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                {uiLanguage === "vi" ? "Giọng đọc Tiếng Việt" : "Vietnamese Host Accent"}
              </label>
              <select
                value={featureSettings.voiceProfile.vietnameseVoice}
                onChange={(e) => updateVoiceProfileValue("vietnameseVoice", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500"
                style={{ minHeight: "44px" }}
              >
                <option value="vi-HN">Giọng Hà Nội (Bắc)</option>
                <option value="vi-HCM">Giọng TP. Hồ Chí Minh (Nam)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                {uiLanguage === "vi" ? "Giọng đọc Tiếng Anh" : "English Host Accent"}
              </label>
              <select
                value={featureSettings.voiceProfile.englishVoice}
                onChange={(e) => updateVoiceProfileValue("englishVoice", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500"
                style={{ minHeight: "44px" }}
              >
                <option value="en-US">US Accent (GA)</option>
                <option value="en-UK">UK Accent (RP)</option>
                <option value="Kore">Kore Host (Gemini)</option>
                <option value="Puck">Puck Host (Gemini)</option>
                <option value="Charon">Charon Host (Gemini)</option>
                <option value="Fenrir">Fenrir Host (Gemini)</option>
                <option value="Zephyr">Zephyr Host (Gemini)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3.5 pt-2">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-500 mb-1">
                <span>{uiLanguage === "vi" ? "Tốc độ đọc" : "Speech Speed"}</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {featureSettings.voiceProfile.speed}x
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={featureSettings.voiceProfile.speed}
                onChange={(e) => updateVoiceProfileValue("speed", parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-500 mb-1">
                <span>{uiLanguage === "vi" ? "Cao độ giọng AI" : "Speech Pitch"}</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {featureSettings.voiceProfile.pitch}
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={featureSettings.voiceProfile.pitch}
                onChange={(e) => updateVoiceProfileValue("pitch", parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none"
              />
            </div>
          </div>
        </section>

        {/* Display and Visual Theme */}
        <section className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sun className="w-4 h-4 text-indigo-500" />
            <span>{uiLanguage === "vi" ? "Giao diện & Ngôn ngữ" : "Theme & Language settings"}</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {uiLanguage === "vi" ? "Chế độ tối (Dark Mode)" : "Dark Visual Theme"}
              </span>
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-lg bg-slate-200 dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:brightness-110 transition flex items-center justify-center"
                style={{ minWidth: "44px", minHeight: "44px" }}
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {uiLanguage === "vi" ? "Ngôn ngữ bản tin" : "Bilingual Preference"}
              </span>
              <select
                value={preferences.language}
                onChange={(e) => updateLanguage(e.target.value as DefaultLanguage)}
                className="bg-transparent border-0 text-xs text-right font-bold focus:ring-0 text-cyan-600 focus:outline-none"
                style={{ minHeight: "44px" }}
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
                <option value="bilingual">Bilingual</option>
              </select>
            </div>
          </div>
        </section>

        {/* Notifications & Offline */}
        <section className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <BellRing className="w-4 h-4 text-cyan-500" />
            <span>{uiLanguage === "vi" ? "Đồng bộ & Thông báo" : "Offline Sync & Alerts"}</span>
          </h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="max-w-[240px]">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {uiLanguage === "vi" ? "Nhận thông báo PWA" : "Smart PWA Push Alerts"}
                </p>
                <p className="text-[10px] text-slate-400">
                  {uiLanguage === "vi" ? "Nhắc nhở cập nhật bản tin và thời tiết trước giờ đi làm." : "Remind summaries and commuting feeds before depart."}
                </p>
              </div>
              <input
                type="checkbox"
                checked={featureSettings.pwaNotificationsEnabled}
                onChange={(e) => updateGeneralSetting("pwaNotificationsEnabled", e.target.checked)}
                className="w-10 h-6 bg-slate-200 dark:bg-slate-850 checked:bg-cyan-500 rounded-full cursor-pointer"
                style={{ minHeight: "44px" }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="max-w-[240px]">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {uiLanguage === "vi" ? "Tự động tải xuống" : "Auto-cache Briefings"}
                </p>
                <p className="text-[10px] text-slate-400">
                  {uiLanguage === "vi" ? "Tự động lưu kịch bản và audio offline khi được tạo." : "Cache script text and audio offline right after synthesized."}
                </p>
              </div>
              <input
                type="checkbox"
                checked={featureSettings.offlineDownloadsAuto}
                onChange={(e) => updateGeneralSetting("offlineDownloadsAuto", e.target.checked)}
                className="w-10 h-6 bg-slate-200 dark:bg-slate-850 checked:bg-cyan-500 rounded-full cursor-pointer"
                style={{ minHeight: "44px" }}
              />
            </div>
          </div>
        </section>

        {/* Accessibility features */}
        <section className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-indigo-500" />
            <span>{uiLanguage === "vi" ? "Hỗ trợ tiếp cận (Accessibility)" : "Accessibility Options"}</span>
          </h4>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800 text-xs">
              <span>{uiLanguage === "vi" ? "Độ tương phản cao" : "High Contrast"}</span>
              <input
                type="checkbox"
                checked={featureSettings.accessibility.highContrast}
                onChange={(e) => updateAccessibilityValue("highContrast", e.target.checked)}
                style={{ minHeight: "44px", minWidth: "44px" }}
              />
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800 text-xs">
              <span>{uiLanguage === "vi" ? "Cỡ chữ lớn" : "Large Font scale"}</span>
              <input
                type="checkbox"
                checked={featureSettings.accessibility.largeFont}
                onChange={(e) => updateAccessibilityValue("largeFont", e.target.checked)}
                style={{ minHeight: "44px", minWidth: "44px" }}
              />
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800 text-xs">
              <span>{uiLanguage === "vi" ? "Giảm hiệu ứng" : "Reduced Motion"}</span>
              <input
                type="checkbox"
                checked={featureSettings.accessibility.reducedMotion}
                onChange={(e) => updateAccessibilityValue("reducedMotion", e.target.checked)}
                style={{ minHeight: "44px", minWidth: "44px" }}
              />
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800 text-xs">
              <span>{uiLanguage === "vi" ? "Tiêu điểm bàn phím" : "Focus outlines"}</span>
              <input
                type="checkbox"
                checked={featureSettings.accessibility.keyboardOnly}
                onChange={(e) => updateAccessibilityValue("keyboardOnly", e.target.checked)}
                style={{ minHeight: "44px", minWidth: "44px" }}
              />
            </div>
          </div>
        </section>

        {/* Privacy options / AI memory resetting */}
        <section className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-cyan-500" />
            <span>{uiLanguage === "vi" ? "Quyền riêng tư & Bảo mật" : "Privacy & Core Cleaners"}</span>
          </h4>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleClearMemory}
              className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
              style={{ minHeight: "44px" }}
            >
              {clearedMemorySuccess 
                ? (uiLanguage === "vi" ? "✓ Đã xóa bộ nhớ" : "✓ Memory Erased")
                : (uiLanguage === "vi" ? "Xóa bộ nhớ trợ lý AI" : "Clear AI Memory")}
            </button>
            
            {onClearAllCache && (
              <button
                onClick={onClearAllCache}
                className="flex-1 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                style={{ minHeight: "44px" }}
              >
                {uiLanguage === "vi" ? "Dọn dẹp lưu trữ ngoại tuyến" : "Clear Storage Cache"}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
