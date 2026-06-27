import React from "react";
import { Database, AlertTriangle, Trash2, HardDrive } from "lucide-react";
import { motion } from "motion/react";

interface StorageStatsProps {
  usedMB: number;
  totalItems: number;
  onClearAll?: () => void;
  uiLanguage?: "vi" | "en";
}

const LIMIT_MB = 50.0;

export default function StorageStats({ usedMB, totalItems, onClearAll, uiLanguage = "vi" }: StorageStatsProps) {
  const percentage = Math.min(100, parseFloat(((usedMB / LIMIT_MB) * 100).toFixed(1)));
  const isCloseToLimit = usedMB >= 40.0;
  const isExceeded = usedMB >= LIMIT_MB;

  const t = {
    vi: {
      title: "Quản Lý Bộ Nhớ Bản Tin",
      used: "Đã sử dụng",
      items: "Bản tin đã lưu",
      clearAllBtn: "Xóa toàn bộ kịch bản và audio",
      warningExceeded: "⚠️ Cảnh báo: Bộ nhớ IndexedDB đã dùng vượt ngưỡng 50MB!",
      warningClose: "⚠️ Sắp đầy bộ nhớ: Bạn đã sử dụng hơn 80% dung lượng tối ưu (40MB/50MB).",
      advice: "Gợi ý: Hãy xóa bớt các bản tin cũ không còn nghe để tránh làm chậm hệ thống và đảm bảo dệt các kịch bản mới mượt mà.",
      noItems: "Chưa sử dụng"
    },
    en: {
      title: "Storage & Workspace Health",
      used: "Used",
      items: "Saved Briefings",
      clearAllBtn: "Clear storage history",
      warningExceeded: "⚠️ Warning: IndexedDB storage usage exceeded 50MB threshold!",
      warningClose: "⚠️ Storage running low: You have used over 80% of optimal capacity (40MB/50MB).",
      advice: "Tip: Delete older or unused briefings to keep performance peak and ensure seamless audio compilation.",
      noItems: "Empty"
    }
  }[uiLanguage];

  // Pick color based on storage status
  const barColorClass = isExceeded
    ? "bg-rose-500"
    : isCloseToLimit
    ? "bg-amber-550"
    : "bg-cyan-500";

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs flex flex-col gap-4 text-slate-700" id="storage-stats-container">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <HardDrive className="w-4.5 h-4.5 text-cyan-600" />
          <span>{t.title}</span>
        </h4>
        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-150 text-[11px] font-mono font-bold text-slate-600">
          <span>{totalItems} {t.items}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 bg-slate-50 border border-slate-150 p-4 rounded-2xl">
        <div className="flex justify-between items-end">
          <span className="text-xs text-slate-500 font-medium">{t.used}</span>
          <span className="text-xs font-mono font-bold text-slate-800">
            {usedMB.toFixed(2)} MB / {LIMIT_MB} MB ({percentage}%)
          </span>
        </div>

        {/* Progress Bar with motion layout animations */}
        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden relative">
          <motion.div
            className={`h-full ${barColorClass} rounded-full`}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Warnings & Advice */}
      {(isCloseToLimit || isExceeded) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3.5 rounded-2xl border text-xs leading-relaxed flex gap-2.5 items-start ${
            isExceeded
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          <AlertTriangle className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${isExceeded ? "text-rose-500" : "text-amber-550"}`} />
          <div className="flex flex-col gap-1">
            <p className="font-bold">
              {isExceeded ? t.warningExceeded : t.warningClose}
            </p>
            <p className="opacity-90">{t.advice}</p>
          </div>
        </motion.div>
      )}

      {/* Clear Storage action if handler is provided and items exist */}
      {onClearAll && totalItems > 0 && (
        <div className="flex justify-end pt-1">
          <button
            onClick={() => {
              const confirmMsg = uiLanguage === "vi"
                ? "Hành động này sẽ xóa toàn bộ danh sách bản tin đã lưu và tất cả các tệp âm thanh trong bộ nhớ máy. Bạn có chắc chắn muốn xóa?"
                : "This action will permanently delete all saved briefings and local audio tracks from IndexedDB. Are you sure?";
              if (window.confirm(confirmMsg)) {
                onClearAll();
              }
            }}
            className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl transition font-medium border border-rose-150 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.clearAllBtn}</span>
          </button>
        </div>
      )}
    </div>
  );
}
