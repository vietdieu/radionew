import React, { useState, useEffect } from "react";
import { 
  Rss, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Sparkles, 
  BookOpen, 
  AlertCircle, 
  Check, 
  ExternalLink,
  Edit,
  X,
  FileText
} from "lucide-react";
import { RSSFeed, RSSArticle } from "../types";
import { saveRSSFeed, getRSSFeeds, deleteRSSFeed } from "../services/storageService";
import { fetchRSSArticles, formatArticlesForPrompt } from "../services/rssService";
import RSSFeedList from "./RSSFeedList";

interface RSSManagerProps {
  uiLanguage: "vi" | "en";
  getApiUrl: (path: string) => string;
  onGenerateFromRSS: (content: string) => void;
  isGenerating: boolean;
  onAddToDraft?: (text: string) => void;
}

export default function RSSManager({
  uiLanguage,
  getApiUrl,
  onGenerateFromRSS,
  isGenerating,
  onAddToDraft
}: RSSManagerProps) {
  const [feeds, setFeeds] = useState<RSSFeed[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Thời sự");
  const [newFeedType, setNewFeedType] = useState<"news" | "podcast" | "blog">("news");
  
  // Editing state
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);

  // Status states
  const [isTesting, setIsTesting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isFetchingArticles, setIsFetchingArticles] = useState(false);
  const [activeArticles, setActiveArticles] = useState<RSSArticle[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<RSSArticle[]>([]);
  const [showArticlesPreview, setShowArticlesPreview] = useState(false);

  // States for the custom brief briefing feature
  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [briefCount, setBriefCount] = useState<number>(5);
  const [briefDateType, setBriefDateType] = useState<"all" | "today" | "range">("today");
  const [briefStartDate, setBriefStartDate] = useState(getTodayDateString());
  const [briefEndDate, setBriefEndDate] = useState(getTodayDateString());

  // Suggested RSS Presets
  const rssPresets = [
    { title: "VnExpress Tin Nổi Bật", url: "https://vnexpress.net/rss/tin-noi-bat.rss", category: "Thời sự", feedType: "news" as const },
    { title: "VnExpress Số Hóa (Công Nghệ)", url: "https://vnexpress.net/rss/so-hoa.rss", category: "Công nghệ", feedType: "news" as const },
    { title: "Tuổi Trẻ - Tin Mới Nhất", url: "https://tuoitre.vn/rss/tin-moi-nhat.rss", category: "Thời sự", feedType: "news" as const },
    {
      id: "giaoduc-thoidai-home",
      title: "Báo Giáo dục & Thời đại",
      url: "https://giaoducthoidai.vn",
      category: "Giáo dục",
      feedType: "news" as const,
      addedAt: new Date().toISOString()
    }
  ];

  const t = {
    managerTitle: uiLanguage === "vi" ? "Quản lý Nguồn tin RSS" : "RSS Feeds Manager",
    managerDesc: uiLanguage === "vi" 
      ? "Đăng ký, dán nhãn các nguồn tin RSS chính thống. Hệ thống tự tổng hợp và phát thanh bản tin CommuteCast cho bạn." 
      : "Subscribe, tag, and organize custom RSS channels. The system will auto-synthesize an audio briefing from aggregated feeds.",
    inputUrlPlaceholder: uiLanguage === "vi" ? "Nhập địa chỉ RSS URL..." : "Enter RSS Feed URL...",
    inputTitlePlaceholder: uiLanguage === "vi" ? "Nhập tên nguồn (ví dụ: VnExpress)..." : "Enter Feed Title (e.g. VnExpress)...",
    btnAdd: uiLanguage === "vi" ? "Thêm nguồn" : "Add Source",
    btnUpdate: uiLanguage === "vi" ? "Cập nhật nguồn" : "Update Source",
    btnCancelEdit: uiLanguage === "vi" ? "Hủy sửa" : "Cancel",
    btnTesting: uiLanguage === "vi" ? "Đang xử lý..." : "Processing...",
    presetsHeader: uiLanguage === "vi" ? "Gợi ý nguồn RSS Việt Nam" : "Vietnamese RSS Suggestions",
    rssListHeader: uiLanguage === "vi" ? "Nguồn đã đăng ký" : "Subscribed Feeds",
    emptyList: uiLanguage === "vi" ? "Chưa đăng ký nguồn RSS nào." : "No registered RSS channels yet.",
    btnFetchSummary: uiLanguage === "vi" ? "Đồng bộ & Cập nhật RSS" : "Sync & Update RSS",
    btnFetchSummaryForce: uiLanguage === "vi" ? "Tải lại (Bỏ qua Cache)" : "Force Reload (Bypass Cache)",
    fetchingArticles: uiLanguage === "vi" ? "Đang đồng bộ..." : "Synchronizing news...",
    previewHeader: uiLanguage === "vi" ? "Bài viết RSS Tổng hợp" : "Aggregated RSS Feed Reader",
    invalidUrl: uiLanguage === "vi" ? "Vui lòng nhập URL hợp lệ" : "Please enter a valid URL",
    testSuccess: uiLanguage === "vi" ? "Đã liên kết nguồn RSS thành công!" : "Successfully verified RSS source!",
    updateSuccess: uiLanguage === "vi" ? "Đã cập nhật nguồn thành công!" : "Successfully updated RSS source!"
  };

  useEffect(() => {
    loadFeedsAndArticles();
  }, []);

  const loadFeedsAndArticles = async () => {
    try {
      const saved = await getRSSFeeds();
      setFeeds(saved);
      // Auto fetch articles immediately on mount if feeds exist (using server-side 5m cache)
      if (saved.length > 0) {
        handleFetchArticles(saved, false);
      }
    } catch (e) {
      console.error("Failed to load RSS feeds", e);
    }
  };

  // Quick preset loading helper
  const handleApplyPreset = (preset: typeof rssPresets[0]) => {
    setNewUrl(preset.url);
    setNewTitle(preset.title);
    setNewCategory(preset.category);
    setNewFeedType(preset.feedType);
    setEditingFeedId(null);
  };

  // Add or Update customized RSS Feed URL
  const handleSaveFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanedUrl = newUrl.trim();
    if (!cleanedUrl || !cleanedUrl.startsWith("http")) {
      setErrorMsg(t.invalidUrl);
      return;
    }

    setIsTesting(true);

    try {
      // Validate with server parser first if it is a new feed or changed URL
      const isUrlChangedOrNew = !editingFeedId || feeds.find(f => f.id === editingFeedId)?.url !== cleanedUrl;

      let finalizedTitle = newTitle.trim();

      if (isUrlChangedOrNew) {
        const testRes = await fetch(getApiUrl(`/api/parse-rss?url=${encodeURIComponent(cleanedUrl)}`));
        if (!testRes.ok) {
          let serverErrorMsg = "";
          try {
            const errData = await testRes.json();
            serverErrorMsg = errData.error;
          } catch {
            // fail safe
          }
          throw new Error(serverErrorMsg || (uiLanguage === "vi" ? "Nguồn RSS không phản hồi hoặc sai định dạng XML." : "RSS link did not respond or XML is invalid."));
        }

        const testData = await testRes.json();
        if (!finalizedTitle) {
          finalizedTitle = testData.title || "RSS Feed";
        }
      }

      if (!finalizedTitle) {
        finalizedTitle = "RSS Source";
      }

      const feed: RSSFeed = {
        id: editingFeedId || "rss-" + Date.now().toString(36),
        url: cleanedUrl,
        title: finalizedTitle,
        category: newCategory,
        feedType: newFeedType,
        addedAt: editingFeedId ? (feeds.find(f => f.id === editingFeedId)?.addedAt || new Date().toLocaleString()) : new Date().toLocaleString()
      };

      await saveRSSFeed(feed);
      setSuccessMsg(editingFeedId ? t.updateSuccess : t.testSuccess);
      setNewUrl("");
      setNewTitle("");
      setEditingFeedId(null);
      
      // Reload feeds and fetch articles
      const updatedFeeds = await getRSSFeeds();
      setFeeds(updatedFeeds);
      handleFetchArticles(updatedFeeds, false);

      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || (uiLanguage === "vi" ? "Không thể liên kết nguồn này." : "Unable to reach RSS feed."));
    } finally {
      setIsTesting(false);
    }
  };

  const handleEditClick = (feed: RSSFeed) => {
    setEditingFeedId(feed.id);
    setNewUrl(feed.url);
    setNewTitle(feed.title);
    setNewCategory(feed.category || "Thời sự");
    setNewFeedType(feed.feedType || "news");
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleCancelEdit = () => {
    setEditingFeedId(null);
    setNewUrl("");
    setNewTitle("");
    setNewCategory("Thời sự");
    setNewFeedType("news");
    setErrorMsg("");
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRSSFeed(id);
      if (editingFeedId === id) {
        handleCancelEdit();
      }
      const updatedFeeds = await getRSSFeeds();
      setFeeds(updatedFeeds);
      if (updatedFeeds.length > 0) {
        handleFetchArticles(updatedFeeds, false);
      } else {
        setActiveArticles([]);
        setSelectedArticles([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteArticle = (article: RSSArticle) => {
    setActiveArticles(prev => prev.filter(a => !(a.link === article.link && a.title === article.title)));
    setSelectedArticles(prev => prev.filter(a => !(a.link === article.link && a.title === article.title)));
  };

  const handleClearAllArticles = () => {
    setActiveArticles([]);
    setSelectedArticles([]);
  };

  // Fetch current articles across all registered feeds
  const handleFetchArticles = async (feedList: RSSFeed[], force: boolean = false) => {
    if (feedList.length === 0) return;

    setIsFetchingArticles(true);
    setErrorMsg("");

    try {
      const articles = await fetchRSSArticles(feedList, getApiUrl, force);
      setActiveArticles(articles);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to fetch articles.");
    } finally {
      setIsFetchingArticles(false);
    }
  };

  // Manual Trigger Button
  const handleManualRefresh = (force: boolean) => {
    if (feeds.length === 0) {
      setErrorMsg(uiLanguage === "vi" ? "Vui lòng thêm ít nhất một nguồn RSS trước!" : "Please add at least one RSS feed first!");
      return;
    }
    handleFetchArticles(feeds, force);
  };

  // Toggle selection for individual articles
  const handleToggleSelectArticle = (art: RSSArticle) => {
    setSelectedArticles(prev => {
      const exists = prev.some(item => item.link === art.link && item.title === art.title);
      if (exists) {
        return prev.filter(item => !(item.link === art.link && item.title === art.title));
      } else {
        return [...prev, art];
      }
    });
  };

  const handleSelectAllArticles = (articlesToSelect: RSSArticle[]) => {
    setSelectedArticles(articlesToSelect);
  };

  const handleClearSelection = () => {
    setSelectedArticles([]);
  };

  // Helper to parse dates in various formats and check if they fall in selected ranges
  const isArticleInDateRange = (
    pubDateStr: string,
    dateType: "all" | "today" | "range",
    startDateStr?: string,
    endDateStr?: string
  ): boolean => {
    if (dateType === "all") return true;
    if (!pubDateStr) return false;

    try {
      // Standard Date parsing
      let pubDate = new Date(pubDateStr);
      
      // Handle custom or Vietnamese formats if invalid
      if (isNaN(pubDate.getTime())) {
        const ddmmyyyyMatch = pubDateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (ddmmyyyyMatch) {
          const day = parseInt(ddmmyyyyMatch[1], 10);
          const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
          const year = parseInt(ddmmyyyyMatch[3], 10);
          pubDate = new Date(year, month, day);
        } else {
          const yyyymmddMatch = pubDateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
          if (yyyymmddMatch) {
            const year = parseInt(yyyymmddMatch[1], 10);
            const month = parseInt(yyyymmddMatch[2], 10) - 1;
            const day = parseInt(yyyymmddMatch[3], 10);
            pubDate = new Date(year, month, day);
          }
        }
      }

      if (isNaN(pubDate.getTime())) {
        const today = new Date();
        const todayStr1 = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
        const todayStr2 = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
        if (dateType === "today") {
          return pubDateStr.includes(todayStr1) || pubDateStr.includes(todayStr2);
        }
        return true;
      }

      const startOfDay = (d: Date) => {
        const res = new Date(d);
        res.setHours(0, 0, 0, 0);
        return res;
      };

      const endOfDay = (d: Date) => {
        const res = new Date(d);
        res.setHours(23, 59, 59, 999);
        return res;
      };

      const articleTime = pubDate.getTime();

      if (dateType === "today") {
        const todayStart = startOfDay(new Date()).getTime();
        const todayEnd = endOfDay(new Date()).getTime();
        return articleTime >= todayStart && articleTime <= todayEnd;
      }

      if (dateType === "range" && startDateStr && endDateStr) {
        const startLimit = startOfDay(new Date(startDateStr)).getTime();
        const endLimit = endOfDay(new Date(endDateStr)).getTime();
        return articleTime >= startLimit && articleTime <= endLimit;
      }
    } catch (e) {
      console.warn("Date parsing helper error:", e);
    }
    return true;
  };

  // Send aggregated text of ALL articles to the main summary drafting stream
  const triggerBriefingGenerationAll = () => {
    if (activeArticles.length === 0) return;
    const rawContent = formatArticlesForPrompt(activeArticles, uiLanguage);
    onGenerateFromRSS(rawContent);
  };

  // Generate a custom BRIEF summary of selected size and timeframe
  const triggerBriefingGenerationBrief = () => {
    if (activeArticles.length === 0) return;

    // Filter by date type
    let filtered = activeArticles.filter(art => 
      isArticleInDateRange(art.pubDate || "", briefDateType, briefStartDate, briefEndDate)
    );

    if (filtered.length === 0) {
      alert(uiLanguage === "vi" 
        ? `Không tìm thấy bài viết nào tương thích với bộ lọc thời gian: ${briefDateType === 'today' ? 'Hôm nay' : 'Từ ngày ' + briefStartDate + ' đến ' + briefEndDate}. Vui lòng thử lại với cấu hình khác!`
        : `No articles found matching the date filters: ${briefDateType === 'today' ? 'Today' : 'From ' + briefStartDate + ' to ' + briefEndDate}. Please try a broader timeframe!`
      );
      return;
    }

    // Sort newer first
    filtered.sort((a, b) => {
      const timeA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const timeB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      if (!isNaN(timeA) && !isNaN(timeB)) {
        return timeB - timeA;
      }
      return 0;
    });

    // Take the limited count
    const limited = filtered.slice(0, briefCount);
    console.log(`[RSS Brief] Selecting top ${limited.length} articles from ${filtered.length} total filtered items for briefing.`);

    const rawContent = formatArticlesForPrompt(limited, uiLanguage);
    onGenerateFromRSS(rawContent);
  };

  // Send aggregated text of SELECTED articles only to the main summary drafting stream
  const triggerBriefingGenerationSelected = (selected: RSSArticle[]) => {
    if (selected.length === 0) return;
    const rawContent = formatArticlesForPrompt(selected, uiLanguage);
    onGenerateFromRSS(rawContent);
  };

  return (
    <div className="space-y-6" id="rss-composite-module">
      {/* 1. Feed Configuration panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-5 text-slate-800">
        {/* Title & Desc */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-cyan-500/10 text-cyan-700 rounded-xl border border-cyan-500/20">
            <Rss className="w-5 h-5 text-cyan-600" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <span>{t.managerTitle}</span>
              <span className="bg-cyan-100 text-cyan-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">
                {uiLanguage === "vi" ? "Đa Kênh" : "Multi-channel"}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">
              {t.managerDesc}
            </p>
          </div>
        </div>

        {/* Subscription / Editing Form */}
        <form onSubmit={handleSaveFeed} className="space-y-3 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <div className="text-left">
            <span className="text-[10px] font-extrabold text-cyan-600 bg-cyan-50 border border-cyan-100 rounded-md px-2 py-0.5 uppercase tracking-wide">
              {editingFeedId ? (uiLanguage === "vi" ? "Đang sửa nguồn" : "Editing Feed") : (uiLanguage === "vi" ? "Thêm nguồn mới" : "Add New Feed")}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder={t.inputUrlPlaceholder}
                required
                className="bg-white border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-medium"
              />
            </div>

            <div className="flex flex-col gap-1">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t.inputTitlePlaceholder}
                className="bg-white border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-medium"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Category and Type selectors */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Category Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {uiLanguage === "vi" ? "Chủ đề:" : "Topic:"}
                </span>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="bg-white border border-slate-200 text-[11px] px-2.5 py-1.5 rounded-lg focus:outline-none font-semibold text-slate-700"
                >
                  <option value="Thời sự">{uiLanguage === "vi" ? "📰 Thời sự" : "📰 General News"}</option>
                  <option value="Công nghệ">{uiLanguage === "vi" ? "💻 Công nghệ" : "💻 Tech"}</option>
                  <option value="Kinh tế">{uiLanguage === "vi" ? "📊 Kinh tế" : "📊 Finance"}</option>
                  <option value="Sức khỏe">{uiLanguage === "vi" ? "🌱 Sức khỏe" : "🌱 Health"}</option>
                  <option value="Giáo dục">{uiLanguage === "vi" ? "🎓 Giáo dục" : "🎓 Education"}</option>
                  <option value="Giải trí">{uiLanguage === "vi" ? "🎭 Giải trí" : "🎭 Entertainment"}</option>
                </select>
              </div>

              {/* Feed Type Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {uiLanguage === "vi" ? "Loại:" : "Style:"}
                </span>
                <select
                  value={newFeedType}
                  onChange={(e) => setNewFeedType(e.target.value as any)}
                  className="bg-white border border-slate-200 text-[11px] px-2.5 py-1.5 rounded-lg focus:outline-none font-semibold text-slate-700"
                >
                  <option value="news">{uiLanguage === "vi" ? "📰 Tin tức" : "📰 News"}</option>
                  <option value="podcast">{uiLanguage === "vi" ? "🎙️ Podcast" : "🎙️ Podcast"}</option>
                  <option value="blog">{uiLanguage === "vi" ? "✍️ Blog" : "✍️ Blog"}</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {editingFeedId && (
                <button
                  type="button"
                  onClick={() => handleCancelEdit()}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-350 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {t.btnCancelEdit}
                </button>
              )}

              <button
                type="submit"
                disabled={isTesting}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isTesting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t.btnTesting}</span>
                  </>
                ) : (
                  <>
                    {editingFeedId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{editingFeedId ? t.btnUpdate : t.btnAdd}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Errors / Success feedback */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-2.5 flex gap-2 items-start text-xs text-rose-700 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="text-left">{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 flex gap-2 items-start text-xs text-emerald-700 font-medium">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-left">{successMsg}</span>
            </div>
          )}
        </form>

        {/* Recommended VN Presets */}
        <div className="space-y-2 text-left">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            💡 {t.presetsHeader}
          </span>
          <div className="flex flex-wrap gap-2">
            {rssPresets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-cyan-50/50 hover:border-cyan-300 text-slate-700 transition cursor-pointer"
              >
                {preset.title}
              </button>
            ))}
          </div>
        </div>

        {/* Subscribed Feeds List */}
        <div className="space-y-2.5 border-t border-slate-100 pt-4 text-left">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            {t.rssListHeader} ({feeds.length})
          </h4>

          {feeds.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              {t.emptyList}
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {feeds.map((feed) => (
                <div 
                  key={feed.id}
                  className={`p-3 rounded-xl border flex justify-between items-center hover:shadow-2xs transition-all text-left ${
                    editingFeedId === feed.id ? "border-cyan-400 bg-cyan-50/20" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="min-w-0 pr-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase tracking-wider">
                        {feed.category}
                      </span>
                      {feed.feedType && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                          {feed.feedType}
                        </span>
                      )}
                    </div>
                    <h5 className="text-xs font-bold text-slate-800 truncate">
                      {feed.title}
                    </h5>
                    <p className="text-[10px] text-slate-400 truncate font-mono">
                      {feed.url}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleEditClick(feed)}
                      className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-slate-50 rounded-lg transition"
                      title="Edit feed info"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <a 
                      href={feed.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"
                      title="Open XML"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(feed.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition"
                      title="Delete feed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Centralized manual RSS Refresh action buttons */}
        {feeds.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => handleManualRefresh(false)}
              disabled={isFetchingArticles}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingArticles ? "animate-spin" : ""}`} />
              <span>{t.btnFetchSummary}</span>
            </button>
            <button
              type="button"
              onClick={() => handleManualRefresh(true)}
              disabled={isFetchingArticles}
              className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingArticles ? "animate-spin" : ""}`} />
              <span>{t.btnFetchSummaryForce}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Consolidated Unified Article Reader Interface (RSSFeedList) */}
      {activeArticles.length > 0 && (
        <RSSFeedList
          articles={activeArticles}
          selectedArticles={selectedArticles}
          onToggleSelectArticle={handleToggleSelectArticle}
          onSelectAllArticles={handleSelectAllArticles}
          onClearSelection={handleClearSelection}
          onAddToDraft={onAddToDraft || (() => {})}
          onGenerateFromSelected={triggerBriefingGenerationSelected}
          uiLanguage={uiLanguage}
          isGenerating={isGenerating}
          onDeleteArticle={handleDeleteArticle}
          onClearAllArticles={handleClearAllArticles}
        />
      )}

      {/* 3. Direct Full Synthesis helper if no articles selected but articles loaded */}
      {activeArticles.length > 0 && selectedArticles.length === 0 && (
        <div className="bg-slate-950 text-slate-100 p-5 rounded-2xl border border-slate-800 text-left space-y-4 shadow-md animate-fade-in">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>{uiLanguage === "vi" ? "Tự động phát thanh" : "Smart Broadcast Suite"}</span>
            </span>
          </div>
          
          <div className="space-y-2">
            <p className="text-[11px] text-slate-300 leading-normal">
              {uiLanguage === "vi" 
                ? `Hệ thống đã đồng bộ được ${activeArticles.length} bài viết mới từ các nguồn tin của bạn. Chọn phương thức tạo bản tin phù hợp dưới đây:` 
                : `Successfully aggregated ${activeArticles.length} active articles. Select your preferred broadcast method below:`}
            </p>
            
            {/* OPTION 1: FULL BRIEFING */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-2 text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {uiLanguage === "vi" ? "Lựa chọn 1: Toàn bộ nguồn tin" : "Option 1: Complete feeds"}
              </span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {uiLanguage === "vi"
                  ? "Tóm tắt và nghe toàn bộ tất cả các bài viết đã đồng bộ (phù hợp khi số lượng tin vừa phải)."
                  : "Summarize and generate voice for all synchronized articles (best for normal volumes)."}
              </p>
              <button
                type="button"
                onClick={() => triggerBriefingGenerationAll()}
                disabled={isGenerating}
                className="w-full py-2 bg-gradient-to-tr from-cyan-500 to-amber-300 hover:from-cyan-400 hover:to-amber-250 text-slate-950 text-xs font-extrabold rounded-lg shadow-sm transform hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                <span>{uiLanguage === "vi" ? "Tạo bản tin toàn bộ nguồn tin RSS" : "Generate Broadcast from All RSS Feeds"}</span>
              </button>
            </div>

            {/* OPTION 2: LATEST BRIEF BRIEFING (CUSTOM FEEDS) */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-3 text-left">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                {uiLanguage === "vi" ? "Lựa chọn 2: Bản tin vắn tắt mới nhất (Khuyên Dùng)" : "Option 2: Latest Short Briefing (Recommended)"}
              </span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {uiLanguage === "vi"
                  ? "Chỉ tóm tắt số lượng tin tức mới nhất theo cấu hình lọc bên dưới để tránh quá tải TTS và ngốn hạn ngạch."
                  : "Filter and summarize only a fixed number of recent articles to stay within TTS rate limits."}
              </p>

              {/* Controls inside option 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/40">
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium text-[10px]">
                    {uiLanguage === "vi" ? "Số lượng tin tối đa:" : "Max articles:"}
                  </label>
                  <select
                    value={briefCount}
                    onChange={(e) => setBriefCount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none cursor-pointer"
                  >
                    <option value={3}>3 {uiLanguage === "vi" ? "bài viết mới" : "news items"}</option>
                    <option value={5}>5 {uiLanguage === "vi" ? "bài viết mới" : "news items"}</option>
                    <option value={10}>10 {uiLanguage === "vi" ? "bài viết mới" : "news items"}</option>
                    <option value={15}>15 {uiLanguage === "vi" ? "bài viết mới" : "news items"}</option>
                    <option value={20}>20 {uiLanguage === "vi" ? "bài viết mới" : "news items"}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-medium text-[10px]">
                    {uiLanguage === "vi" ? "Lọc thời gian:" : "Timeframe:"}
                  </label>
                  <select
                    value={briefDateType}
                    onChange={(e) => setBriefDateType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none cursor-pointer"
                  >
                    <option value="all">{uiLanguage === "vi" ? "Tất cả các tin" : "All articles"}</option>
                    <option value="today">{uiLanguage === "vi" ? "Hôm nay" : "Today"}</option>
                    <option value="range">{uiLanguage === "vi" ? "Chọn khoảng ngày..." : "Date range..."}</option>
                  </select>
                </div>
              </div>

              {/* Date pickers */}
              {briefDateType === "range" && (
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] border-t border-slate-800/40">
                  <div className="space-y-1 text-left">
                    <label className="text-slate-400 font-medium text-[9px]">
                      {uiLanguage === "vi" ? "Từ ngày:" : "From:"}
                    </label>
                    <input
                      type="date"
                      value={briefStartDate}
                      onChange={(e) => setBriefStartDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-0.5 text-slate-200 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-slate-400 font-medium text-[9px]">
                      {uiLanguage === "vi" ? "Đến ngày:" : "To:"}
                    </label>
                    <input
                      type="date"
                      value={briefEndDate}
                      onChange={(e) => setBriefEndDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-0.5 text-slate-200 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={triggerBriefingGenerationBrief}
                disabled={isGenerating}
                className="w-full py-2 bg-gradient-to-tr from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 text-xs font-extrabold rounded-lg shadow-sm transform hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                <span>{uiLanguage === "vi" ? "Tạo bản tin vắn tắt mới nhất từ nguồn tin RSS" : "Generate Custom Brief from RSS"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
