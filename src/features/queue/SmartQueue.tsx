// src/features/queue/SmartQueue.tsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  ListMusic, 
  Sparkles, 
  Check, 
  ListX,
  Shuffle,
  Repeat,
  Moon,
  Heart,
  History,
  Car,
  ChevronDown,
  Clock
} from "lucide-react";
import { 
  getPlayQueue, 
  savePlayQueue, 
  removeFromQueue, 
  featureStoreEvents,
  getPlaybackHistory,
  clearPlaybackHistory,
  getFavoriteIds,
  toggleFavoriteId,
  getRepeatMode,
  setRepeatMode,
  getAutoContinue,
  setAutoContinue,
  addToPlaybackHistory,
  addToQueue
} from "../store";
import { QueueItem } from "../types";
import { getAllBriefings, incrementBriefingLikes } from "../../services/storageService";
import { useUserPreferences } from "../../components/UserPreferencesProvider";

interface SmartQueueProps {
  onSelectItem: (item: any) => void;
  activeItemId?: string;
  uiLanguage?: "vi" | "en";
}

export function SmartQueue({ onSelectItem, activeItemId, uiLanguage = "vi" }: SmartQueueProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [historyList, setHistoryList] = useState<QueueItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [allBriefings, setAllBriefings] = useState<any[]>([]);
  
  const [repeatMode, setRepeatModeState] = useState<"off" | "all" | "one">("off");
  const [autoContinue, setAutoContinueState] = useState<boolean>(true);
  
  const [showSleepTimerMenu, setShowSleepTimerMenu] = useState(false);
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState<number | null>(null);
  const [sleepAtBriefingEnd, setSleepAtBriefingEnd] = useState(false);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const { updateDrivingMode, preferences: userPref } = useUserPreferences();

  // Load all data
  const refreshAll = async () => {
    setQueue(getPlayQueue());
    setHistoryList(getPlaybackHistory());
    setFavoriteIds(getFavoriteIds());
    setRepeatModeState(getRepeatMode());
    setAutoContinueState(getAutoContinue());
    setSleepAtBriefingEnd(localStorage.getItem("cc_sleep_at_briefing_end") === "true");
    
    try {
      const data = await getAllBriefings(false);
      setAllBriefings(data);
    } catch (e) {
      console.warn("Failed to fetch briefings list:", e);
    }
  };

  useEffect(() => {
    refreshAll();
    featureStoreEvents.addEventListener("change", refreshAll);
    return () => {
      featureStoreEvents.removeEventListener("change", refreshAll);
    };
  }, []);

  // Sleep Timer Countdown ticking
  useEffect(() => {
    const savedLeft = localStorage.getItem("cc_sleep_seconds_left");
    if (savedLeft) {
      setSleepSecondsLeft(Number(savedLeft));
    }

    const interval = setInterval(() => {
      const leftStr = localStorage.getItem("cc_sleep_seconds_left");
      const sleepAtEnd = localStorage.getItem("cc_sleep_at_briefing_end") === "true";
      setSleepAtBriefingEnd(sleepAtEnd);

      if (leftStr) {
        const left = Number(leftStr);
        if (left > 0) {
          const newLeft = left - 1;
          setSleepSecondsLeft(newLeft);
          localStorage.setItem("cc_sleep_seconds_left", String(newLeft));
          if (newLeft === 0) {
            window.dispatchEvent(new CustomEvent("commutecast-pause"));
            localStorage.removeItem("cc_sleep_seconds_left");
            setSleepSecondsLeft(null);
            showToast(uiLanguage === "vi" ? "Đã tạm dừng theo hẹn giờ ngủ" : "Sleep timer ended. Playback paused.");
          }
        } else {
          setSleepSecondsLeft(null);
          localStorage.removeItem("cc_sleep_seconds_left");
        }
      } else {
        setSleepSecondsLeft(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [uiLanguage]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Reordering
  const moveItem = (index: number, direction: "up" | "down" | "top" | "bottom") => {
    if (queue.length <= 1) return;
    const updated = [...queue];
    const item = updated[index];
    
    if (direction === "up") {
      if (index === 0) return;
      updated.splice(index, 1);
      updated.splice(index - 1, 0, item);
    } else if (direction === "down") {
      if (index === queue.length - 1) return;
      updated.splice(index, 1);
      updated.splice(index + 1, 0, item);
    } else if (direction === "top") {
      if (index === 0) return;
      updated.splice(index, 1);
      updated.unshift(item);
    } else if (direction === "bottom") {
      if (index === queue.length - 1) return;
      updated.splice(index, 1);
      updated.push(item);
    }
    
    savePlayQueue(updated);
    showToast(uiLanguage === "vi" ? "Đã cập nhật thứ tự phát" : "Playback queue reordered");
  };

  const handleClearQueue = () => {
    savePlayQueue([]);
    showToast(uiLanguage === "vi" ? "Đã xóa sạch hàng đợi tiếp theo" : "Next up queue cleared");
  };

  const handleClearHistory = () => {
    clearPlaybackHistory();
    showToast(uiLanguage === "vi" ? "Đã xóa lịch sử phát" : "Playback history cleared");
  };

  const handleShuffle = () => {
    if (queue.length <= 1) {
      showToast(uiLanguage === "vi" ? "Cần ít nhất 2 bản tin để ngẫu nhiên hóa" : "Need at least 2 items to shuffle");
      return;
    }
    const shuffled = [...queue].sort(() => Math.random() - 0.5);
    savePlayQueue(shuffled);
    showToast(uiLanguage === "vi" ? "Đã xáo trộn thứ tự phát" : "Queue shuffled successfully!");
  };

  const handleToggleRepeat = () => {
    let nextMode: "off" | "all" | "one" = "off";
    if (repeatMode === "off") nextMode = "all";
    else if (repeatMode === "all") nextMode = "one";
    
    setRepeatMode(nextMode);
    showToast(
      nextMode === "off" 
        ? (uiLanguage === "vi" ? "Tắt lặp lại" : "Repeat mode off") 
        : nextMode === "all" 
          ? (uiLanguage === "vi" ? "Lặp lại tất cả" : "Repeat all items") 
          : (uiLanguage === "vi" ? "Lặp lại 1 bài" : "Repeat current item")
    );
  };

  const handleToggleAutoContinue = () => {
    const nextVal = !autoContinue;
    setAutoContinue(nextVal);
    showToast(
      nextVal 
        ? (uiLanguage === "vi" ? "Bật tự động phát tiếp" : "Auto-continue enabled") 
        : (uiLanguage === "vi" ? "Tắt tự động phát tiếp" : "Auto-continue disabled")
    );
  };

  const handleSleepTimerSelect = (mins: number | "end" | "off") => {
    if (mins === "off") {
      localStorage.removeItem("cc_sleep_seconds_left");
      localStorage.removeItem("cc_sleep_at_briefing_end");
      setSleepSecondsLeft(null);
      setSleepAtBriefingEnd(false);
      showToast(uiLanguage === "vi" ? "Đã tắt hẹn giờ ngủ" : "Sleep timer turned off");
    } else if (mins === "end") {
      localStorage.removeItem("cc_sleep_seconds_left");
      localStorage.setItem("cc_sleep_at_briefing_end", "true");
      setSleepSecondsLeft(null);
      setSleepAtBriefingEnd(true);
      showToast(uiLanguage === "vi" ? "Sẽ tắt sau khi hết bản tin hiện tại" : "Will pause after current briefing");
    } else {
      const seconds = mins * 60;
      localStorage.setItem("cc_sleep_seconds_left", String(seconds));
      localStorage.removeItem("cc_sleep_at_briefing_end");
      setSleepSecondsLeft(seconds);
      setSleepAtBriefingEnd(false);
      showToast(uiLanguage === "vi" ? `Sẽ tắt sau ${mins} phút` : `Timer set for ${mins} minutes`);
    }
    setShowSleepTimerMenu(false);
  };

  const handleToggleFavorite = async (item: any) => {
    toggleFavoriteId(item.id);
    await incrementBriefingLikes(item.id);
    refreshAll();
  };

  const formatItemDuration = (item: QueueItem) => {
    if (item.duration) {
      const mins = Math.floor(item.duration / 60);
      const secs = Math.floor(item.duration % 60);
      return `${mins}m ${secs}s`;
    }
    
    // Fallback estimate
    if (item.payload?.chapters) {
      const totalChars = item.payload.chapters.reduce((a: number, b: any) => a + (b.scriptText?.length || 0), 0);
      const estSecs = Math.round(totalChars * 0.08) + 120;
      const mins = Math.floor(estSecs / 60);
      const secs = Math.floor(estSecs % 60);
      return `${mins}m ${secs}s`;
    }
    return "2m";
  };

  const formatTimerLabel = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Get current active briefing item from saved library
  const currentPlayingItem = allBriefings.find(b => b.id === activeItemId);

  // Sum next queue estimated time
  const calculateTotalQueueDuration = () => {
    let totalSecs = 0;
    queue.forEach(item => {
      if (item.duration) {
        totalSecs += item.duration;
      } else if (item.payload?.chapters) {
        const totalChars = item.payload.chapters.reduce((a: number, b: any) => a + (b.scriptText?.length || 0), 0);
        totalSecs += Math.round(totalChars * 0.08) + 120;
      } else {
        totalSecs += 120;
      }
    });
    
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs}s`;
  };

  // Filter list of favorited briefings
  const favoriteBriefings = allBriefings.filter(b => favoriteIds.includes(b.id) || (b.likeCount && b.likeCount > 0));

  const t = {
    vi: {
      nowPlaying: "Đang Phát",
      nextUp: "Tiếp Theo",
      history: "Lịch Sử",
      favorites: "Yêu Thích",
      emptyQueue: "Hàng đợi đang trống",
      noHistory: "Chưa có lịch sử nghe",
      noFavorites: "Chưa có bản tin yêu thích nào",
      clearAll: "Xóa hết",
      shuffle: "Trộn bài",
      repeat: "Lặp lại",
      autoContinue: "Tự động tiếp tục",
      sleepTimer: "Hẹn giờ ngủ",
      drivingMode: "Chế độ lái xe",
      totalTime: "Tổng thời gian còn lại",
      addToQueue: "Thêm vào hàng đợi",
      playImmediately: "Phát ngay"
    },
    en: {
      nowPlaying: "Now Playing",
      nextUp: "Next up",
      history: "History",
      favorites: "Favorites",
      emptyQueue: "Playback queue is empty",
      noHistory: "No playback history",
      noFavorites: "No favorited briefings",
      clearAll: "Clear all",
      shuffle: "Shuffle",
      repeat: "Repeat",
      autoContinue: "Auto Continue",
      sleepTimer: "Sleep Timer",
      drivingMode: "Driving Mode",
      totalTime: "Estimated remaining time",
      addToQueue: "Add to queue",
      playImmediately: "Play now"
    }
  }[uiLanguage];

  return (
    <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col text-left gap-6 relative overflow-visible" id="spotify-queue-container">
      
      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-cyan-500 text-slate-950 text-xs font-bold px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Control Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        
        {/* Core Spotify Toggles */}
        <div className="flex items-center gap-1.5">
          {/* Shuffle Toggle */}
          <button
            onClick={handleShuffle}
            disabled={queue.length <= 1}
            className={`p-2 rounded-xl transition ${
              queue.length <= 1
                ? "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
            }`}
            title={t.shuffle}
            style={{ minHeight: "44px", minWidth: "44px" }}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {/* Repeat Toggle */}
          <button
            onClick={handleToggleRepeat}
            className={`p-2 rounded-xl transition relative active:scale-95 flex items-center justify-center ${
              repeatMode !== "off"
                ? "text-cyan-500 bg-cyan-500/10"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title={`${t.repeat}: ${repeatMode}`}
            style={{ minHeight: "44px", minWidth: "44px" }}
          >
            <Repeat className="w-5 h-5" />
            {repeatMode === "one" && (
              <span className="absolute bottom-1 right-1 text-[8px] font-black bg-cyan-500 text-slate-950 px-1 rounded-full scale-90">1</span>
            )}
          </button>

          {/* Auto Continue Toggle */}
          <button
            onClick={handleToggleAutoContinue}
            className={`p-2 rounded-xl transition active:scale-95 flex items-center justify-center ${
              autoContinue
                ? "text-emerald-500 bg-emerald-500/10"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title={t.autoContinue}
            style={{ minHeight: "44px", minWidth: "44px" }}
          >
            <Play className={`w-5 h-5 ${autoContinue ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* Utilities: Sleep Timer & Driving Mode */}
        <div className="flex items-center gap-2 relative">
          
          {/* Sleep Timer button */}
          <div className="relative">
            <button
              onClick={() => setShowSleepTimerMenu(!showSleepTimerMenu)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition border active:scale-95 ${
                sleepSecondsLeft !== null || sleepAtBriefingEnd
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                  : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
              }`}
              style={{ minHeight: "44px" }}
              title={t.sleepTimer}
            >
              <Moon className="w-4 h-4" />
              {sleepSecondsLeft !== null ? (
                <span className="font-mono text-xs">{formatTimerLabel(sleepSecondsLeft)}</span>
              ) : sleepAtBriefingEnd ? (
                <span className="text-[10px]">{uiLanguage === "vi" ? "Hết bài" : "End"}</span>
              ) : (
                <span className="hidden sm:inline">{t.sleepTimer}</span>
              )}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {/* Sleep Timer Dropdown List */}
            {showSleepTimerMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-2 animate-fade-in text-xs font-bold text-slate-800 dark:text-slate-200">
                <button 
                  onClick={() => handleSleepTimerSelect(5)} 
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                >
                  <span>5 {uiLanguage === "vi" ? "phút" : "minutes"}</span>
                </button>
                <button 
                  onClick={() => handleSleepTimerSelect(15)} 
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                >
                  <span>15 {uiLanguage === "vi" ? "phút" : "minutes"}</span>
                </button>
                <button 
                  onClick={() => handleSleepTimerSelect(30)} 
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                >
                  <span>30 {uiLanguage === "vi" ? "phút" : "minutes"}</span>
                </button>
                <button 
                  onClick={() => handleSleepTimerSelect(45)} 
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                >
                  <span>45 {uiLanguage === "vi" ? "phút" : "minutes"}</span>
                </button>
                <button 
                  onClick={() => handleSleepTimerSelect(60)} 
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between"
                >
                  <span>60 {uiLanguage === "vi" ? "phút" : "minutes"}</span>
                </button>
                <button 
                  onClick={() => handleSleepTimerSelect("end")} 
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-500"
                >
                  <span>{uiLanguage === "vi" ? "Hết bản tin hiện tại" : "End of current briefing"}</span>
                </button>
                <hr className="my-1.5 border-slate-100 dark:border-slate-800" />
                <button 
                  onClick={() => handleSleepTimerSelect("off")} 
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-500"
                >
                  <span>{uiLanguage === "vi" ? "Tắt hẹn giờ" : "Turn off timer"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Driving Mode Launch */}
          <button
            onClick={() => updateDrivingMode(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs bg-cyan-500 text-slate-950 hover:bg-cyan-400 active:scale-95 transition"
            style={{ minHeight: "44px" }}
            title={t.drivingMode}
          >
            <Car className="w-4 h-4" />
            <span className="hidden sm:inline">{t.drivingMode}</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Now Playing */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
          <Play className="w-3 h-3 fill-current" />
          <span>{t.nowPlaying}</span>
        </h4>
        
        {currentPlayingItem ? (
          <div className="p-4 bg-gradient-to-r from-cyan-500/10 to-teal-500/5 dark:from-cyan-950/20 dark:to-slate-900 border border-cyan-500/30 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 overflow-hidden flex-1">
              <div className="w-10 h-10 rounded-xl bg-cyan-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
                <ListMusic className="w-5 h-5 animate-pulse" />
              </div>
              <div className="overflow-hidden">
                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm truncate">
                  {currentPlayingItem.payload?.title || (uiLanguage === "vi" ? "Bản tin hành trình" : "Commute Podcast")}
                </p>
                <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                  {currentPlayingItem.payload?.introduction?.substring(0, 70) || currentPlayingItem.preferences?.locationName || "CommuteCast"}...
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                {currentPlayingItem.payload?.chapters ? `${currentPlayingItem.payload.chapters.length} ${uiLanguage === "vi" ? "chương" : "chaps"}` : ""}
              </span>
              
              {/* Toggle Favorite Heart */}
              <button
                onClick={() => handleToggleFavorite(currentPlayingItem)}
                className={`p-2 rounded-xl transition ${
                  favoriteIds.includes(currentPlayingItem.id) || (currentPlayingItem.likeCount && currentPlayingItem.likeCount > 0)
                    ? "text-rose-500 hover:bg-rose-500/10"
                    : "text-slate-400 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-500/5"
                }`}
                style={{ minHeight: "44px", minWidth: "44px" }}
              >
                <Heart className={`w-5 h-5 ${favoriteIds.includes(currentPlayingItem.id) || (currentPlayingItem.likeCount && currentPlayingItem.likeCount > 0) ? "fill-current" : ""}`} />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 py-6">
            {uiLanguage === "vi" ? "Chưa có bản tin nào đang phát" : "No active briefing currently playing"}
          </div>
        )}
      </div>

      {/* SECTION 2: Next Up */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <ListMusic className="w-3.5 h-3.5" />
            <span>{t.nextUp}</span>
            {queue.length > 0 && (
              <span className="normal-case text-[10px] text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold ml-1.5">
                {queue.length} items • {calculateTotalQueueDuration()}
              </span>
            )}
          </h4>
          
          {queue.length > 0 && (
            <button
              onClick={handleClearQueue}
              className="text-[10px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 transition flex items-center gap-1"
              style={{ minHeight: "36px" }}
            >
              <ListX className="w-3.5 h-3.5" />
              <span>{t.clearAll}</span>
            </button>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 text-xs">
            {t.emptyQueue}
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {queue.map((item, index) => {
                const isFavorite = favoriteIds.includes(item.id);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    layout
                    className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3 hover:shadow-sm transition"
                  >
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                      <button
                        onClick={() => onSelectItem(item)}
                        className="p-2 bg-slate-100 hover:bg-cyan-500 hover:text-slate-950 rounded-xl transition text-slate-600 dark:text-slate-300 shrink-0"
                        style={{ minWidth: "40px", minHeight: "40px" }}
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </button>
                      
                      <div className="overflow-hidden">
                        <p className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate">
                          {item.title}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {item.subtitle} • <span className="font-mono text-[9px]">{formatItemDuration(item)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Spotify Ordering / Favoriting & Removal Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      
                      {/* Heart Favorite toggle */}
                      <button
                        onClick={() => handleToggleFavorite(item)}
                        className={`p-1.5 rounded-lg transition ${
                          isFavorite 
                            ? "text-rose-500 hover:bg-rose-500/10" 
                            : "text-slate-300 dark:text-slate-700 hover:text-rose-500 hover:bg-rose-500/5"
                        }`}
                        title="Favorite"
                        style={{ minHeight: "36px", minWidth: "36px" }}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
                      </button>

                      {/* Micro-reordering buttons */}
                      <button
                        disabled={index === 0}
                        onClick={() => moveItem(index, "up")}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25 transition"
                        title="Move Up"
                        style={{ minHeight: "32px", minWidth: "32px" }}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        disabled={index === queue.length - 1}
                        onClick={() => moveItem(index, "down")}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25 transition"
                        title="Move Down"
                        style={{ minHeight: "32px", minWidth: "32px" }}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      
                      {/* Remove */}
                      <button
                        onClick={() => removeFromQueue(item.id)}
                        className="p-1.5 text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition"
                        title="Remove"
                        style={{ minHeight: "36px", minWidth: "36px" }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* SECTION 3: Playback History */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />
            <span>{t.history}</span>
          </h4>
          
          {historyList.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-[10px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 transition flex items-center gap-1"
              style={{ minHeight: "36px" }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.clearAll}</span>
            </button>
          )}
        </div>

        {historyList.length === 0 ? (
          <div className="py-6 text-center bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 text-xs">
            {t.noHistory}
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
            {historyList.map((item) => {
              const isFavorite = favoriteIds.includes(item.id);
              return (
                <div 
                  key={item.id} 
                  className="p-2.5 bg-slate-100/60 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 rounded-xl flex items-center justify-between gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition"
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <button
                      onClick={() => onSelectItem(item)}
                      className="p-1.5 bg-slate-200/80 hover:bg-cyan-500 hover:text-slate-950 rounded-lg text-slate-600 dark:text-slate-400 shrink-0 transition"
                      style={{ minWidth: "34px", minHeight: "34px" }}
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>
                    <div className="overflow-hidden">
                      <p className="font-bold text-xs text-slate-700 dark:text-slate-300 truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {item.subtitle} • <span className="font-mono text-[9px]">{formatItemDuration(item)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleToggleFavorite(item)}
                      className={`p-1.5 rounded-lg transition ${
                        isFavorite 
                          ? "text-rose-500 hover:bg-rose-500/10" 
                          : "text-slate-300 dark:text-slate-700 hover:text-rose-500"
                      }`}
                      style={{ minHeight: "36px", minWidth: "36px" }}
                    >
                      <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 4: Favorites */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          <span>{t.favorites}</span>
          {favoriteBriefings.length > 0 && (
            <span className="normal-case text-[10px] text-slate-400 bg-slate-250 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold ml-1.5">
              {favoriteBriefings.length}
            </span>
          )}
        </h4>

        {favoriteBriefings.length === 0 ? (
          <div className="py-6 text-center bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 text-xs">
            {t.noFavorites}
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
            {favoriteBriefings.map((item) => {
              const queueItem: QueueItem = {
                id: item.id,
                title: item.payload?.title || "Briefing",
                subtitle: item.preferences?.locationName || "CommuteCast",
                type: "custom",
                payload: item.payload
              };
              
              const isInQueue = queue.some(q => q.id === item.id);

              return (
                <div 
                  key={item.id} 
                  className="p-2.5 bg-slate-100/60 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 rounded-xl flex items-center justify-between gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition"
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <button
                      onClick={() => onSelectItem(item)}
                      className="p-1.5 bg-slate-200/80 hover:bg-cyan-500 hover:text-slate-950 rounded-lg text-slate-600 dark:text-slate-400 shrink-0 transition"
                      style={{ minWidth: "34px", minHeight: "34px" }}
                      title={t.playImmediately}
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>
                    <div className="overflow-hidden">
                      <p className="font-bold text-xs text-slate-700 dark:text-slate-300 truncate">
                        {item.payload?.title || "Untitled Briefing"}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {item.preferences?.locationName || "CommuteCast"} • <span className="font-mono text-[9px]">{formatItemDuration(queueItem)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Add to Queue Button */}
                    <button
                      onClick={() => {
                        addToQueue(queueItem);
                        showToast(uiLanguage === "vi" ? "Đã thêm vào hàng đợi" : "Added to queue");
                      }}
                      disabled={isInQueue}
                      className={`p-1.5 rounded-lg text-[10px] font-bold border transition ${
                        isInQueue
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                      }`}
                      style={{ minHeight: "36px" }}
                    >
                      {isInQueue ? <Check className="w-3.5 h-3.5" /> : t.addToQueue}
                    </button>

                    {/* Heart button to toggle favorite */}
                    <button
                      onClick={() => handleToggleFavorite(item)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition"
                      style={{ minHeight: "36px", minWidth: "36px" }}
                    >
                      <Heart className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
