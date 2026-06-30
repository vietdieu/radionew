// src/features/memory/PersonalMemory.tsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Brain, Trash2, ShieldAlert, Sparkles, AlertCircle, Trash } from "lucide-react";
import { getPersonalMemory, savePersonalMemory, clearPersonalMemory, featureStoreEvents, PersonalizedMemory } from "../store";

interface PersonalMemoryProps {
  uiLanguage?: "vi" | "en";
}

export function PersonalMemory({ uiLanguage = "vi" }: PersonalMemoryProps) {
  const [memory, setMemory] = useState<PersonalizedMemory | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const refreshMemory = () => {
    setMemory(getPersonalMemory());
  };

  useEffect(() => {
    refreshMemory();
    featureStoreEvents.addEventListener("change", refreshMemory);
    return () => {
      featureStoreEvents.removeEventListener("change", refreshMemory);
    };
  }, []);

  if (!memory) return null;

  const removeTopic = (id: string) => {
    const updated = { ...memory };
    updated.favoriteTopics = updated.favoriteTopics.filter(t => t.id !== id);
    savePersonalMemory(updated);
  };

  const handleClearAll = () => {
    clearPersonalMemory();
    setShowConfirmClear(false);
  };

  return (
    <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col text-left" id="personal-ai-memory-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-cyan-500 animate-pulse-subtle" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200">
            {uiLanguage === "vi" ? "Trí Nhớ Trợ Lý AI" : "Personal AI Memory"}
          </h3>
        </div>
        {memory.favoriteTopics.length > 0 && (
          <button
            onClick={() => setShowConfirmClear(true)}
            className="text-xs text-rose-500 hover:text-rose-600 transition flex items-center gap-1"
            style={{ minHeight: "44px" }}
          >
            <Trash className="w-3.5 h-3.5" />
            {uiLanguage === "vi" ? "Xóa bộ nhớ" : "Clear memory"}
          </button>
        )}
      </div>

      <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mb-4 leading-relaxed">
        {uiLanguage === "vi" 
          ? "AI của CommuteCast tự động ghi nhận các chủ đề, chuyên mục bạn thường nghe để cá nhân hóa đề xuất tin tức. Dữ liệu này chỉ được lưu cục bộ và có thể xóa bất cứ lúc nào."
          : "CommuteCast automatically remembers topics and source feeds you listen to, personalizing your smart recommendations. This data is kept 100% locally and private."}
      </p>

      {/* Confirmation Dialog overlay inside the component */}
      <AnimatePresence>
        {showConfirmClear && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-4 mb-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex flex-col gap-3"
          >
            <div className="flex gap-2 text-rose-500 text-xs font-semibold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                {uiLanguage === "vi" 
                  ? "Bạn chắc chắn muốn xóa toàn bộ thông tin AI đã ghi nhớ?" 
                  : "Are you sure you want to completely erase your AI memory?"}
              </span>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs"
                style={{ minHeight: "36px" }}
              >
                {uiLanguage === "vi" ? "Hủy" : "Cancel"}
              </button>
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs hover:bg-rose-500 transition"
                style={{ minHeight: "36px" }}
              >
                {uiLanguage === "vi" ? "Xóa hết bộ nhớ" : "Clear Memory"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {memory.favoriteTopics.length === 0 ? (
        <div className="py-8 px-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center">
          <Brain className="w-8 h-8 text-slate-300 mb-2 stroke-[1.5]" />
          <p className="text-slate-600 dark:text-slate-400 text-xs">
            {uiLanguage === "vi" ? "AI chưa ghi nhận sở thích nào." : "AI memory is currently clean."}
          </p>
          <p className="text-slate-400 text-[10px] max-w-[200px] mt-1">
            {uiLanguage === "vi" ? "Khi bạn bắt đầu nghe, bộ nhớ thông minh sẽ hiển thị tại đây." : "Once you start listening, your preferences will appear here."}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-1">
          <AnimatePresence>
            {memory.favoriteTopics.map((topicItem) => (
              <motion.div
                key={topicItem.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 pl-3 pr-1 py-1 bg-cyan-500/5 hover:bg-cyan-500/10 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/15 border border-cyan-500/20 text-slate-700 dark:text-cyan-300 rounded-full text-xs font-medium transition"
              >
                <Sparkles className="w-3 h-3 text-cyan-500" />
                <span className="truncate max-w-[150px]">{topicItem.topic}</span>
                <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 rounded-full text-[10px] font-mono">
                  {topicItem.interactedCount}
                </span>
                <button
                  onClick={() => removeTopic(topicItem.id)}
                  className="p-1 text-slate-400 hover:text-rose-500 rounded-full hover:bg-rose-500/10 transition"
                  style={{ minWidth: "24px", minHeight: "24px" }}
                  title={uiLanguage === "vi" ? "Xóa chủ đề này" : "Forget this topic"}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Quick metadata about memory status */}
      {memory.favoriteTopics.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 flex justify-between items-center">
          <span>{uiLanguage === "vi" ? "Đồng bộ hóa: Cục bộ / Sync: Local Only" : "Data sync: Local sandbox"}</span>
          <span>
            {uiLanguage === "vi" ? `Lần hoạt động cuối: ${memory.lastActiveDate}` : `Last active: ${memory.lastActiveDate}`}
          </span>
        </div>
      )}
    </div>
  );
}
