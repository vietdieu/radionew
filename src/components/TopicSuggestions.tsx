import React from "react";
import { Sparkles, Compass, HelpCircle } from "lucide-react";
import { usePreferences } from "../hooks/usePreferences";

interface TopicSuggestionsProps {
  uiLanguage: "vi" | "en";
  onSelectTopic: (topic: string) => void;
  isGenerating: boolean;
}

export default function TopicSuggestions({
  uiLanguage,
  onSelectTopic,
  isGenerating
}: TopicSuggestionsProps) {
  const { topTopics, isLoading } = usePreferences(5);

  const titleText = uiLanguage === "vi" ? "Chủ đề gợi ý cho bạn" : "Recommended for you";
  const descText = uiLanguage === "vi" 
    ? "Bản tin cá nhân hóa dựa trên lịch sử hoạt động của bạn. Bấm một chủ đề để phát thanh." 
    : "Personalized news topics based on your activity. Click any topic to broadcast.";

  const defaultTopics = uiLanguage === "vi"
    ? ["Trí tuệ nhân tạo", "Công nghệ", "Kinh tế", "Giao thông", "Thời tiết"]
    : ["AI", "Technology", "Finance", "Traffic", "Weather"];

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6" id="topic-suggestions-container">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <Compass className="w-4 h-4 text-amber-500 animate-spin-slow" />
        </div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <span>{titleText}</span>
          <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">
            {uiLanguage === "vi" ? "Thông minh" : "Smart AI"}
          </span>
        </h4>
      </div>
      
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 block leading-relaxed">
        {descText}
      </p>

      {/* States: Loading, Empty, or Filled list */}
      {isLoading ? (
        /* Loading Skeleton */
        <div className="flex flex-wrap gap-2 animate-pulse" id="suggestions-skeleton">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className="h-7 w-24 bg-slate-200 dark:bg-slate-800 rounded-full"
            />
          ))}
        </div>
      ) : topTopics.length === 0 ? (
        /* Empty State with Fallback Default Topics */
        <div className="space-y-3" id="suggestions-empty-state">
          <div className="flex items-center gap-1.5 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850">
            <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {uiLanguage === "vi"
                ? "Chưa có đủ lịch sử để gợi ý riêng. Hãy tương tác nhiều hơn! Dưới đây là các chủ đề mặc định:"
                : "Not enough history for personalized topics yet. Here are some trending topics to start:"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {defaultTopics.map((topic, index) => (
              <button
                key={topic + "-" + index}
                onClick={() => !isGenerating && onSelectTopic(topic)}
                disabled={isGenerating}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all border flex items-center gap-1.5 active:scale-95 ${
                  isGenerating
                    ? "bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed"
                    : "bg-slate-50 dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-slate-700 dark:text-slate-300 hover:text-amber-800 dark:hover:text-amber-400 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700 shadow-sm hover:shadow-md hover:scale-[1.03]"
                }`}
              >
                <Sparkles className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{topic}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Personalized Topics Filled List */
        <div className="flex flex-wrap gap-2 animate-fade-in" id="suggestions-filled-list">
          {topTopics.map((pref, index) => (
            <button
              key={pref.topic + "-" + index}
              onClick={() => !isGenerating && onSelectTopic(pref.topic)}
              disabled={isGenerating}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all border flex items-center gap-1.5 active:scale-95 group ${
                isGenerating
                  ? "bg-slate-50 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed"
                  : "bg-gradient-to-tr from-amber-50 to-white dark:from-amber-950/10 dark:to-slate-900 hover:from-amber-100 hover:to-amber-50 dark:hover:from-amber-950/30 dark:hover:to-slate-850 text-slate-800 dark:text-slate-200 hover:text-amber-900 dark:hover:text-amber-300 border-amber-200/60 dark:border-amber-900/30 hover:border-amber-300 dark:hover:border-amber-700 shadow-sm hover:shadow-md hover:scale-[1.03]"
              }`}
              title={`${uiLanguage === "vi" ? "Điểm mức độ quan tâm" : "Interest score"}: ${pref.score.toFixed(1)}`}
            >
              <Sparkles className="w-3 h-3 text-amber-500 shrink-0 group-hover:animate-bounce" />
              <span>{pref.topic}</span>
              <span className="text-[8px] bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-400 px-1 py-0.2 rounded-md font-mono font-bold">
                {pref.score > 99 ? "99+" : pref.score.toFixed(0)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
