import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  AudioLines, 
  Rss, 
  ListMusic, 
  History, 
  BarChart3, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  BookOpen,
  Sparkles,
  Menu,
  X
} from "lucide-react";

export type TabType = "dashboard" | "rss" | "queue" | "memory" | "stats" | "settings";

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  uiLanguage: "vi" | "en";
  unreadQueueCount?: number;
  unreadRssCount?: number;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  uiLanguage,
  unreadQueueCount = 0,
  unreadRssCount = 0
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("commutecast_sidebar_collapsed") === "true";
    }
    return false;
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("commutecast_sidebar_collapsed", String(isCollapsed));
  }, [isCollapsed]);

  // Labels based on language
  const labels = {
    vi: {
      dashboard: "Bản tin chính",
      rss: "Nguồn tin RSS",
      queue: "Hàng đợi phát",
      memory: "Nhật ký lưu trữ",
      stats: "Thống kê nghe",
      settings: "Cài đặt cá nhân",
      collapse: "Thu gọn",
      expand: "Mở rộng",
      menu: "Danh mục",
      bilingualTag: "SONG NGỮ"
    },
    en: {
      dashboard: "Briefing Desk",
      rss: "RSS Channels",
      queue: "Smart Queue",
      memory: "Saved Briefings",
      stats: "Listener Stats",
      settings: "Preferences",
      collapse: "Collapse",
      expand: "Expand",
      menu: "Menu",
      bilingualTag: "BILINGUAL"
    }
  }[uiLanguage];

  const menuItems = [
    { id: "dashboard", label: labels.dashboard, icon: AudioLines, badge: null },
    { id: "rss", label: labels.rss, icon: Rss, badge: unreadRssCount > 0 ? unreadRssCount : null },
    { id: "queue", label: labels.queue, icon: ListMusic, badge: unreadQueueCount > 0 ? unreadQueueCount : null },
    { id: "memory", label: labels.memory, icon: History, badge: null },
    { id: "stats", label: labels.stats, icon: BarChart3, badge: null },
    { id: "settings", label: labels.settings, icon: Settings, badge: null }
  ] as const;

  return (
    <>
      {/* MOBILE HEADER BAR & HAMBURGER TRIGGER */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-card-bg border-b border-border-primary sticky top-14 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-amber-500 flex items-center justify-center shadow-md">
            <AudioLines className="w-5 h-5 text-slate-950 dark:text-white" />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-text-main">CommuteCast</span>
            <span className="ml-1.5 text-[8px] bg-brand-accent/10 text-brand-accent px-1.5 py-0.5 rounded-full border border-brand-accent/20">
              3.0
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 bg-surface-bg hover:bg-bg-secondary border border-border-primary rounded-xl text-text-main transition active:scale-95"
          aria-label="Toggle menu"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR FOR SPEED DIAL */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card-bg border-t border-border-primary z-50 px-2 py-1.5 flex justify-around items-center shadow-lg backdrop-blur-md bg-opacity-95">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileOpen(false);
              }}
              className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all relative ${
                isActive 
                  ? "text-brand-accent" 
                  : "text-text-muted hover:text-text-main"
              }`}
              style={{ minWidth: "55px" }}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? "scale-110" : "scale-100"}`} />
                {item.badge !== null && (
                  <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-bold px-1 rounded-full border border-card-bg">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-medium tracking-tight text-center max-w-[64px] truncate">
                {item.id === "dashboard" ? (uiLanguage === "vi" ? "Bản tin" : "Brief") :
                 item.id === "rss" ? "RSS" :
                 item.id === "queue" ? (uiLanguage === "vi" ? "Hàng đợi" : "Queue") :
                 item.id === "memory" ? (uiLanguage === "vi" ? "Nhật ký" : "Logs") :
                 item.id === "stats" ? (uiLanguage === "vi" ? "Thống kê" : "Stats") :
                 (uiLanguage === "vi" ? "Cài đặt" : "Settings")}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="activeMobileDot" 
                  className="w-1 h-1 bg-brand-accent rounded-full absolute -bottom-1"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* MOBILE DRAWER (FALLBACK FULL MENU) */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 transition-opacity animate-fade-in" onClick={() => setIsMobileOpen(false)}>
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            className="w-4/5 max-w-[280px] h-full bg-card-bg border-r border-border-primary p-5 flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-border-primary">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-amber-500 flex items-center justify-center">
                    <AudioLines className="w-5 h-5 text-slate-950 dark:text-white" />
                  </div>
                  <div>
                    <span className="font-extrabold text-sm tracking-tight text-text-main">CommuteCast</span>
                    <span className="ml-1 text-[8px] bg-brand-accent/10 text-brand-accent px-1.5 py-0.5 rounded-full">3.1</span>
                  </div>
                </div>
                <button onClick={() => setIsMobileOpen(false)} className="p-1 hover:bg-surface-bg rounded-lg">
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              <div className="space-y-1.5">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-xs transition cursor-pointer ${
                        isActive 
                          ? "bg-brand-accent/10 text-brand-accent border-l-4 border-brand-accent" 
                          : "text-text-muted hover:bg-surface-bg hover:text-text-main"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== null && (
                        <span className="bg-rose-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pb-8 text-[10px] text-text-muted font-mono">
              <p>CommuteCast Engine v3.1</p>
              <p className="mt-1 opacity-70">© 2026 Bilingual Broadcast</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside 
        className={`hidden md:flex flex-col justify-between bg-card-bg border-r border-border-primary sticky top-16 h-[calc(100vh-4rem)] transition-all duration-300 z-30 shrink-0 ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="p-4 space-y-6">
          {/* Header Brand within Sidebar */}
          <div className="flex items-center justify-between pb-4 border-b border-border-primary/50">
            <div className={`flex items-center gap-3 overflow-hidden transition-all ${isCollapsed ? "justify-center w-full" : ""}`}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-amber-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
                <AudioLines className="w-5 h-5 text-slate-950 dark:text-white" />
              </div>
              {!isCollapsed && (
                <div className="animate-fade-in text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm tracking-tight text-text-main">CommuteCast</span>
                    <span className="bg-brand-accent/10 text-brand-accent text-[8px] font-black px-1.5 py-0.5 rounded-full border border-brand-accent/20 shrink-0">
                      3.1
                    </span>
                  </div>
                  <p className="text-[9px] font-bold tracking-widest text-brand-accent/80 uppercase mt-0.5">{labels.bilingualTag}</p>
                </div>
              )}
            </div>
          </div>

          {/* Nav Menu Items */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center rounded-xl transition-all duration-150 relative cursor-pointer select-none ${
                    isActive 
                      ? "bg-brand-accent/10 text-brand-accent font-bold" 
                      : "text-text-muted hover:bg-surface-bg hover:text-text-main"
                  } ${isCollapsed ? "justify-center p-3" : "px-4 py-3 justify-between"}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-brand-accent scale-110" : "text-text-muted"}`} />
                    {!isCollapsed && (
                      <span className="text-xs tracking-wide animate-fade-in">{item.label}</span>
                    )}
                  </div>

                  {item.badge !== null && (
                    <span className={`bg-rose-500 text-white font-extrabold rounded-full ${
                      isCollapsed 
                        ? "absolute top-2 right-2 text-[8px] px-1" 
                        : "text-[9px] px-2 py-0.5"
                    }`}>
                      {item.badge}
                    </span>
                  )}

                  {!isCollapsed && isActive && (
                    <motion.div 
                      layoutId="activeDeskDot" 
                      className="w-1 h-3 bg-brand-accent rounded-full absolute left-0 top-1/2 -translate-y-1/2"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Collapse Controls at bottom of Sidebar */}
        <div className="p-4 border-t border-border-primary/50 space-y-4">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-surface-bg hover:bg-bg-secondary border border-border-primary rounded-xl text-text-muted hover:text-text-main text-xs transition cursor-pointer select-none"
            title={isCollapsed ? labels.expand : labels.collapse}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="font-semibold text-[11px] uppercase tracking-wider">{labels.collapse}</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
