import React from "react";
import { Sparkles, Compass } from "lucide-react";
import { SavedSummary } from "../types";

interface TopicSuggestionsProps {
  savedBriefings: SavedSummary[];
  uiLanguage: "vi" | "en";
  onSelectTopic: (topic: string) => void;
  isGenerating: boolean;
}

export default function TopicSuggestions({
  savedBriefings,
  uiLanguage,
  onSelectTopic,
  isGenerating
}: TopicSuggestionsProps) {
  // Extract common topics or return fallbacks
  const getExtractedTopics = (): string[] => {
    const topicsMap: Record<string, number> = {};
    
    // Default fallback lists based on active language
    const defaults = uiLanguage === "vi" 
      ? ["Công nghệ", "Giáo dục", "Thời sự", "Sức khỏe", "Giao thông"]
      : ["Technology", "Education", "World News", "Health", "Commuting"];

    // Count frequencies of topics in saved briefings
    if (savedBriefings && Array.isArray(savedBriefings)) {
      savedBriefings.forEach(briefing => {
        const chapters = briefing.payload?.chapters || [];
        chapters.forEach(ch => {
          if (ch.topic) {
            const cleanTopic = ch.topic.trim();
            // Filter out extremely long or short topics for clean UI chips
            if (cleanTopic.length > 2 && cleanTopic.length < 25) {
              const formatted = cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1);
              topicsMap[formatted] = (topicsMap[formatted] || 0) + 1;
            }
          }
        });
      });
    }

    // Sort extracted topics by frequency (descending)
    const sortedExtracted = Object.keys(topicsMap)
      .sort((a, b) => topicsMap[b] - topicsMap[a]);

    // Combine extracted with defaults case-insensitively to prevent duplicates
    const seen = new Set<string>();
    const finalTopics: string[] = [];

    // Add actual history topics first
    sortedExtracted.forEach(t => {
      const lower = t.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        finalTopics.push(t);
      }
    });

    // Pad with fallback categories to reach at least 5 options
    defaults.forEach(t => {
      const lower = t.toLowerCase();
      if (!seen.has(lower) && finalTopics.length < 5) {
        seen.add(lower);
        finalTopics.push(t);
      }
    });

    return finalTopics.slice(0, 5); // Return top 3-5 chips
  };

  const topics = getExtractedTopics();

  const titleText = uiLanguage === "vi" ? "Chủ đề gợi ý cho bạn" : "Recommended for you";
  const descText = uiLanguage === "vi" 
    ? "Dựa trên các bản tin của bạn. Cú click chuột sẽ tự tạo tin bài tương ứng." 
    : "Suggested topics based on your history. Click to generate matching news.";

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs mb-6" id="topic-suggestions-container">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <Compass className="w-4 h-4 text-amber-500 animate-spin-slow" />
        </div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <span>{titleText}</span>
          <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">
            {uiLanguage === "vi" ? "Thông minh" : "Smart"}
          </span>
        </h4>
      </div>
      
      <p className="text-[11px] text-slate-500 mb-4 block leading-relaxed">
        {descText}
      </p>

      <div className="flex flex-wrap gap-2">
        {topics.map((topic, index) => (
          <button
            key={topic + "-" + index}
            onClick={() => !isGenerating && onSelectTopic(topic)}
            disabled={isGenerating}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all border flex items-center gap-1.5 active:scale-95 ${
              isGenerating
                ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                : "bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border-slate-200 hover:border-amber-300 shadow-2xs hover:shadow-xs"
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
            <span>{topic}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
