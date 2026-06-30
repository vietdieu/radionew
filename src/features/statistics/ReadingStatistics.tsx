// src/features/statistics/ReadingStatistics.tsx
import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { BarChart3, Clock, PlayCircle, Globe, Award, Sparkles, TrendingUp } from "lucide-react";
import { getListenStats, featureStoreEvents, ListenStats } from "../store";

interface ReadingStatisticsProps {
  uiLanguage?: "vi" | "en";
}

export function ReadingStatistics({ uiLanguage = "vi" }: ReadingStatisticsProps) {
  const [stats, setStats] = useState<ListenStats | null>(null);

  const refreshStats = () => {
    setStats(getListenStats());
  };

  useEffect(() => {
    refreshStats();
    featureStoreEvents.addEventListener("change", refreshStats);
    return () => {
      featureStoreEvents.removeEventListener("change", refreshStats);
    };
  }, []);

  if (!stats) return null;

  const totalMinutes = Math.round(stats.totalSeconds / 60);
  const totalHours = (stats.totalSeconds / 3600).toFixed(1);

  // Maximum value for daily history to scale charts
  const maxDailySeconds = Math.max(...stats.dailyHistory.map(d => d.seconds), 1);

  // Categories list ordered by frequency
  const categories = Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col text-left" id="reading-statistics-panel">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-5 h-5 text-indigo-500" />
        <h3 className="font-bold text-slate-800 dark:text-slate-200">
          {uiLanguage === "vi" ? "Thống Kê Phát Thanh" : "Listening Insights & Stats"}
        </h3>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Clock className="w-4 h-4 text-cyan-500" />
            <span>{uiLanguage === "vi" ? "Tổng thời gian nghe" : "Total listen time"}</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 font-mono">
            {totalMinutes > 0 ? `${totalMinutes}m` : `${stats.totalSeconds}s`}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            {uiLanguage === "vi" ? `Khoảng ${totalHours} giờ nghe` : `Approx. ${totalHours} hrs`}
          </p>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <PlayCircle className="w-4 h-4 text-indigo-500" />
            <span>{uiLanguage === "vi" ? "Bản tin đã phát" : "Stories completed"}</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 font-mono">
            {stats.totalStoriesRead}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            {uiLanguage === "vi" ? "Đã tổng hợp qua AI" : "AI Summaries broadcasted"}
          </p>
        </div>
      </div>

      {/* Daily Listening History chart */}
      <div className="mb-6">
        <h4 className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-cyan-500" />
          {uiLanguage === "vi" ? "Biểu đồ hoạt động (7 ngày)" : "Listening Activity (7 days)"}
        </h4>
        <div className="flex items-end justify-between h-28 gap-2 px-1 pt-4 border-b border-slate-100 dark:border-slate-800">
          {stats.dailyHistory.map((day, idx) => {
            const pct = Math.max(8, Math.min(100, (day.seconds / maxDailySeconds) * 100));
            return (
              <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative">
                {/* Tooltip */}
                <div className="absolute -top-8 px-2 py-1 bg-slate-800 text-slate-100 text-[10px] rounded shadow-md opacity-0 group-hover:opacity-100 transition duration-150 pointer-events-none whitespace-nowrap z-10 font-mono">
                  {day.seconds > 60 ? `${Math.round(day.seconds / 60)}m` : `${day.seconds}s`}
                </div>
                {/* Bar */}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${pct}%` }}
                  transition={{ delay: idx * 0.05, duration: 0.4 }}
                  className="w-full max-w-[18px] bg-gradient-to-t from-indigo-500 to-cyan-400 rounded-t-lg group-hover:brightness-110 shadow-sm"
                />
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1.5 shrink-0">
                  {day.date}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Language splits / categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-cyan-500" />
            {uiLanguage === "vi" ? "Ngôn ngữ ưa thích" : "Language Preferences"}
          </h4>
          <div className="flex flex-col gap-2">
            {Object.entries(stats.byLanguage).map(([lang, count]) => {
              const total = Object.values(stats.byLanguage).reduce((a, b) => a + b, 0) || 1;
              const pct = Math.round((count / total) * 100);
              const label = lang === "vi" ? "Tiếng Việt" : lang === "en" ? "English" : "Song ngữ / Bilingual";
              return (
                <div key={lang} className="text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300 mb-1">
                    <span className="font-medium">{label}</span>
                    <span className="text-slate-400 font-mono">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-850 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(stats.byLanguage).length === 0 && (
              <p className="text-xs text-slate-400">{uiLanguage === "vi" ? "Chưa có dữ liệu" : "No statistics yet"}</p>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-indigo-500" />
            {uiLanguage === "vi" ? "Chủ đề thường nghe" : "Top Heard Topics"}
          </h4>
          <div className="flex flex-col gap-2">
            {categories.map(([cat, count]) => {
              const total = Object.values(stats.byCategory).reduce((a, b) => a + b, 0) || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={cat} className="text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300 mb-1">
                    <span className="font-medium truncate max-w-[120px]">{cat}</span>
                    <span className="text-slate-400 font-mono">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-850 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {categories.length === 0 && (
              <p className="text-xs text-slate-400">{uiLanguage === "vi" ? "Chưa có dữ liệu" : "No statistics yet"}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
