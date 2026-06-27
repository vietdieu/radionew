import React, { useState, useMemo } from "react";
import { 
  FileText, 
  Check, 
  Plus, 
  Sparkles, 
  Search, 
  Filter, 
  BookOpen, 
  ExternalLink,
  Calendar,
  Layers,
  Rss,
  Trash2
} from "lucide-react";
import { RSSArticle } from "../types";

interface RSSFeedListProps {
  articles: RSSArticle[];
  selectedArticles: RSSArticle[];
  onToggleSelectArticle: (article: RSSArticle) => void;
  onSelectAllArticles: (articlesToSelect: RSSArticle[]) => void;
  onClearSelection: () => void;
  onAddToDraft: (text: string) => void;
  onGenerateFromSelected: (articles: RSSArticle[]) => void;
  uiLanguage: "vi" | "en";
  isGenerating: boolean;
  onDeleteArticle?: (article: RSSArticle) => void;
  onClearAllArticles?: () => void;
}

export default function RSSFeedList({
  articles,
  selectedArticles,
  onToggleSelectArticle,
  onSelectAllArticles,
  onClearSelection,
  onAddToDraft,
  onGenerateFromSelected,
  uiLanguage,
  isGenerating,
  onDeleteArticle,
  onClearAllArticles
}: RSSFeedListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedType, setSelectedType] = useState<string>("All");

  const t = {
    searchPlaceholder: uiLanguage === "vi" ? "Tìm kiếm bài viết..." : "Search articles...",
    categoryLabel: uiLanguage === "vi" ? "Chủ đề" : "Category",
    typeLabel: uiLanguage === "vi" ? "Loại nguồn" : "Feed Type",
    all: uiLanguage === "vi" ? "Tất cả" : "All",
    news: uiLanguage === "vi" ? "📰 Báo chí" : "📰 News",
    podcast: uiLanguage === "vi" ? "🎙️ Podcast" : "🎙️ Podcast",
    blog: uiLanguage === "vi" ? "✍️ Blog" : "✍️ Blog",
    selectedCount: uiLanguage === "vi" ? "Đã chọn" : "Selected",
    btnAddToDraft: uiLanguage === "vi" ? "Thêm vào soạn thảo" : "Append to Draft",
    btnGenerateNow: uiLanguage === "vi" ? "Tạo bản tin từ nguồn đã chọn" : "Generate Briefing from Selected",
    noArticles: uiLanguage === "vi" ? "Không tìm thấy bài viết nào khớp với bộ lọc." : "No articles found matching the current filters.",
    selectAll: uiLanguage === "vi" ? "Chọn tất cả" : "Select All",
    deselectAll: uiLanguage === "vi" ? "Bỏ chọn tất cả" : "Deselect All",
    readMore: uiLanguage === "vi" ? "Đọc bài gốc" : "Read Source Article",
    totalArticles: uiLanguage === "vi" ? "Tổng số tin tức" : "Total Articles",
    noContent: uiLanguage === "vi" ? "Không có tóm tắt chi tiết." : "No content description available."
  };

  // Extract unique categories from articles
  const categories = useMemo(() => {
    const list = new Set<string>();
    articles.forEach(art => {
      if (art.feedCategory) {
        list.add(art.feedCategory);
      }
    });
    return ["All", ...Array.from(list)];
  }, [articles]);

  // Filter articles based on search term, category, and feedType
  const filteredArticles = useMemo(() => {
    return articles.filter(art => {
      const matchSearch = 
        art.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        art.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        art.feedTitle?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory = selectedCategory === "All" || art.feedCategory === selectedCategory;
      
      const matchType = selectedType === "All" || art.feedType === selectedType;

      return matchSearch && matchCategory && matchType;
    });
  }, [articles, searchTerm, selectedCategory, selectedType]);

  const isAllFilteredSelected = useMemo(() => {
    if (filteredArticles.length === 0) return false;
    return filteredArticles.every(art => 
      selectedArticles.some(sel => sel.link === art.link && sel.title === art.title)
    );
  }, [filteredArticles, selectedArticles]);

  const handleSelectAllToggle = () => {
    if (isAllFilteredSelected) {
      // Deselect all filtered
      const remaining = selectedArticles.filter(sel => 
        !filteredArticles.some(filt => filt.link === sel.link && filt.title === sel.title)
      );
      onSelectAllArticles(remaining);
    } else {
      // Select all filtered (merge with existing)
      const merged = [...selectedArticles];
      filteredArticles.forEach(art => {
        if (!merged.some(sel => sel.link === art.link && sel.title === art.title)) {
          merged.push(art);
        }
      });
      onSelectAllArticles(merged);
    }
  };

  const handleAddToDraftClick = () => {
    if (selectedArticles.length === 0) return;
    const formatted = selectedArticles.map((art, idx) => {
      const source = art.feedTitle ? ` (Nguồn: ${art.feedTitle})` : "";
      return `[Tin tức #${idx + 1}] ${art.title}${source}\n${art.content || ""}`;
    }).join("\n\n---\n\n");
    onAddToDraft(formatted);
  };

  // Helper to format nice readable dates
  const formatDateString = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        // Return sliced pubdate string
        return dateStr.split(" ").slice(0, 4).join(" ");
      }
      return date.toLocaleDateString(uiLanguage === "vi" ? "vi-VN" : "en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5" id="rss-unified-feed-list">
      {/* Header and Counters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-600" />
            <span>{t.totalArticles} ({filteredArticles.length}/{articles.length})</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {uiLanguage === "vi" ? "Chọn lọc các bài viết chất lượng từ RSS để đưa trực tiếp vào studio phát sóng." : "Select news and blogs from RSS feeds to load directly into the audio studio."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {onClearAllArticles && articles.length > 0 && (
            <button
              type="button"
              onClick={onClearAllArticles}
              className="text-[10px] font-extrabold text-rose-600 bg-rose-50 border border-rose-250 px-3 py-1.5 rounded-full hover:bg-rose-100 transition cursor-pointer flex items-center gap-1 shrink-0"
              title={uiLanguage === "vi" ? "Xóa toàn bộ tin tức" : "Clear all articles"}
            >
              <Trash2 className="w-3 h-3 text-rose-500" />
              <span>{uiLanguage === "vi" ? "Xóa tất cả tin" : "Clear all"}</span>
            </button>
          )}

          {selectedArticles.length > 0 && (
            <span className="bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shrink-0">
              <Check className="w-3.5 h-3.5" />
              {t.selectedCount}: <strong>{selectedArticles.length}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative md:col-span-2">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-medium"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-transparent border-none text-xs font-semibold text-slate-700 w-full focus:outline-none cursor-pointer"
          >
            <option value="All">{t.categoryLabel}: {t.all}</option>
            {categories.filter(c => c !== "All").map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
          <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-transparent border-none text-xs font-semibold text-slate-700 w-full focus:outline-none cursor-pointer"
          >
            <option value="All">{t.typeLabel}: {t.all}</option>
            <option value="news">{t.news}</option>
            <option value="podcast">{t.podcast}</option>
            <option value="blog">{t.blog}</option>
          </select>
        </div>
      </div>

      {/* Floating / Contextual Action Bar when articles are selected */}
      {selectedArticles.length > 0 && (
        <div className="p-3 bg-gradient-to-r from-slate-900 to-cyan-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md animate-fade-in-up">
          <span className="text-[11px] font-bold text-slate-200">
            {uiLanguage === "vi" 
              ? `Đã chọn ${selectedArticles.length} bài viết. Bạn muốn:` 
              : `Selected ${selectedArticles.length} articles. What would you like to do?`}
          </span>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleAddToDraftClick()}
              className="flex-1 sm:flex-initial px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t.btnAddToDraft}</span>
            </button>

            <button
              type="button"
              disabled={isGenerating}
              onClick={() => onGenerateFromSelected(selectedArticles)}
              className="flex-1 sm:flex-initial px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[11px] font-extrabold rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-950 animate-pulse" />
              <span>{t.btnGenerateNow}</span>
            </button>
          </div>
        </div>
      )}

      {/* Selection Helpers and Article Shelf */}
      <div className="space-y-3">
        {filteredArticles.length > 0 && (
          <div className="flex justify-between items-center px-1">
            <button
              type="button"
              onClick={() => handleSelectAllToggle()}
              className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1.5"
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                isAllFilteredSelected 
                  ? "bg-cyan-600 border-cyan-600 text-white" 
                  : "border-slate-300 hover:border-slate-400 bg-white"
              }`}>
                {isAllFilteredSelected && <Check className="w-3 h-3 stroke-[3]" />}
              </span>
              <span>{isAllFilteredSelected ? t.deselectAll : t.selectAll} ({filteredArticles.length})</span>
            </button>

            {selectedArticles.length > 0 && (
              <button
                type="button"
                onClick={() => onClearSelection()}
                className="text-xs font-semibold text-rose-500 hover:text-rose-600"
              >
                {uiLanguage === "vi" ? "Hủy chọn tất cả" : "Clear selection"}
              </button>
            )}
          </div>
        )}

        {/* Scrollable list */}
        {filteredArticles.length === 0 ? (
          <div className="py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50 text-center text-xs text-slate-400 italic">
            {t.noArticles}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
            {filteredArticles.map((art, idx) => {
              const isSelected = selectedArticles.some(
                sel => sel.link === art.link && sel.title === art.title
              );

              return (
                <div 
                  key={idx}
                  onClick={() => onToggleSelectArticle(art)}
                  className={`p-4 rounded-2xl border transition-all text-left flex gap-3 cursor-pointer select-none relative ${
                    isSelected 
                      ? "bg-cyan-50/40 border-cyan-300 shadow-2xs" 
                      : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/30"
                  }`}
                >
                  {/* Select Checkbox Indicator */}
                  <div className="shrink-0 pt-0.5">
                    <span className={`w-4.5 h-4.5 rounded-lg border flex items-center justify-center transition-all ${
                      isSelected 
                        ? "bg-cyan-500 border-cyan-500 text-white" 
                        : "border-slate-300 bg-white group-hover:border-slate-400"
                    }`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                  </div>

                  {/* Text Content */}
                  <div className="min-w-0 flex-1 space-y-1.5 relative">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5 truncate">
                          {art.feedTitle}
                        </span>
                        {art.feedCategory && (
                          <span className="text-[9px] font-extrabold text-slate-500 bg-slate-100 rounded-md px-1.5 py-0.5">
                            {art.feedCategory}
                          </span>
                        )}
                        {art.feedType && (
                          <span className="text-[9px] font-extrabold text-cyan-600 bg-cyan-50 rounded-md px-1.5 py-0.5 uppercase font-mono">
                            {art.feedType}
                          </span>
                        )}
                      </div>

                      {onDeleteArticle && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteArticle(art);
                          }}
                          className="p-1 text-slate-350 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0"
                          title={uiLanguage === "vi" ? "Xóa bài viết này khỏi danh sách" : "Remove this article"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">
                      {art.title}
                    </h4>

                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">
                      {art.content || t.noContent}
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 font-medium">
                      <div className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-slate-300" />
                        <span>{formatDateString(art.pubDate)}</span>
                      </div>

                      {art.link && (
                        <a 
                          href={art.link} 
                          target="_blank" 
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-0.5 text-cyan-600 hover:text-cyan-700 hover:underline"
                          title={t.readMore}
                        >
                          <span>{uiLanguage === "vi" ? "Gốc" : "Source"}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
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
