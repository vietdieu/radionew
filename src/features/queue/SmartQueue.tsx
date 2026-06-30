// src/features/queue/SmartQueue.tsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Trash2, ArrowUp, ArrowDown, ListMusic, Sparkles, Check, ListX } from "lucide-react";
import { getPlayQueue, savePlayQueue, removeFromQueue, featureStoreEvents } from "../store";
import { QueueItem } from "../types";

interface SmartQueueProps {
  onSelectItem: (item: any) => void;
  activeItemId?: string;
  uiLanguage?: "vi" | "en";
}

export function SmartQueue({ onSelectItem, activeItemId, uiLanguage = "vi" }: SmartQueueProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const refreshQueue = () => {
    setQueue(getPlayQueue());
  };

  useEffect(() => {
    refreshQueue();
    featureStoreEvents.addEventListener("change", refreshQueue);
    return () => {
      featureStoreEvents.removeEventListener("change", refreshQueue);
    };
  }, []);

  const moveItem = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= queue.length) return;

    const updated = [...queue];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;

    savePlayQueue(updated);
  };

  const handleClear = () => {
    savePlayQueue([]);
  };

  return (
    <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col text-left" id="smart-queue-container">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ListMusic className="w-5 h-5 text-cyan-500" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200">
            {uiLanguage === "vi" ? "Hàng Đợi Phát Thông Minh" : "Smart Playback Queue"}
          </h3>
        </div>
        {queue.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 transition"
            style={{ minHeight: "44px", minWidth: "44px" }}
            title={uiLanguage === "vi" ? "Xóa hàng đợi" : "Clear queue"}
          >
            <ListX className="w-4 h-4" />
            <span className="hidden sm:inline">{uiLanguage === "vi" ? "Xóa hết" : "Clear all"}</span>
          </button>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="py-8 px-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center">
          <ListMusic className="w-8 h-8 text-slate-400 mb-2 stroke-[1.5]" />
          <p className="text-slate-700 dark:text-slate-300 font-medium text-xs sm:text-sm">
            {uiLanguage === "vi" ? "Hàng đợi đang trống" : "Queue is empty"}
          </p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1 max-w-[260px]">
            {uiLanguage === "vi" 
              ? "Lưu các bản tin từ danh sách yêu thích hoặc bản tin đề xuất để phát tự động liên tục." 
              : "Add briefings or favorite episodes to queue up continuous playlist play."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {queue.map((item, index) => {
              const isActive = item.id === activeItemId;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  layout
                  className={`group p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                    isActive
                      ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400"
                      : "bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <button
                      onClick={() => onSelectItem(item)}
                      className={`p-2.5 rounded-xl shrink-0 transition ${
                        isActive
                          ? "bg-cyan-500 text-slate-950"
                          : "bg-slate-200/60 dark:bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-500"
                      }`}
                      style={{ minWidth: "44px", minHeight: "44px" }}
                    >
                      {isActive ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : (
                        <Play className="w-4 h-4 fill-current text-current" />
                      )}
                    </button>
                    <div className="overflow-hidden">
                      <p className="font-semibold text-xs sm:text-sm truncate leading-tight">
                        {item.title}
                      </p>
                      <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Ordering and remove controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      disabled={index === 0}
                      onClick={() => moveItem(index, "up")}
                      className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-850 disabled:opacity-30 transition"
                      style={{ minWidth: "36px", minHeight: "36px" }}
                      title={uiLanguage === "vi" ? "Di chuyển lên" : "Move up"}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      disabled={index === queue.length - 1}
                      onClick={() => moveItem(index, "down")}
                      className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-850 disabled:opacity-30 transition"
                      style={{ minWidth: "36px", minHeight: "36px" }}
                      title={uiLanguage === "vi" ? "Di chuyển xuống" : "Move down"}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeFromQueue(item.id)}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 transition ml-1"
                      style={{ minWidth: "36px", minHeight: "36px" }}
                      title={uiLanguage === "vi" ? "Xóa khỏi hàng đợi" : "Remove from queue"}
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
  );
}
