import React, { useState } from "react";
import { 
  Podcast, 
  Copy, 
  ExternalLink, 
  Trash2, 
  Play, 
  Check, 
  Settings, 
  Radio, 
  Info, 
  BookOpen, 
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { SavedSummary, PublishedEpisode } from "../types";

interface PodcastManagerProps {
  savedBriefings: SavedSummary[];
  podcastEpisodes: PublishedEpisode[];
  isPublishingPodcast: boolean;
  podcastError: string;
  onPublishPodcast: (briefId: string) => Promise<void>;
  onDeletePodcastEpisode: (id: string, e: React.MouseEvent) => Promise<void>;
  uiLanguage: "vi" | "en";
  isAutoPublish: boolean;
  setIsAutoPublish: (val: boolean) => void;
  selectedBriefId: string;
  setSelectedBriefId: (val: string) => void;
}

export default function PodcastManager({
  savedBriefings,
  podcastEpisodes,
  isPublishingPodcast,
  podcastError,
  onPublishPodcast,
  onDeletePodcastEpisode,
  uiLanguage,
  isAutoPublish,
  setIsAutoPublish,
  selectedBriefId,
  setSelectedBriefId,
}: PodcastManagerProps) {
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const t = {
    title: uiLanguage === "vi" ? "Kênh Podcast Cá Nhân" : "Personal Podcast Channel",
    desc: uiLanguage === "vi" 
      ? "Đăng ký bằng mã RSS trên Spotify, Apple Podcasts để nghe bản tin phát thanh CommuteCast tự động trên xe hơi hoặc điện thoại của bạn."
      : "Subscribe with your personal RSS feed on Spotify, Apple Podcasts to listen to automated CommuteCast briefings on your phone or car.",
    rssLabel: uiLanguage === "vi" ? "Địa chỉ RSS Feed chính thức" : "Official RSS Feed Address",
    copyBtn: uiLanguage === "vi" ? "Sao chép link" : "Copy Link",
    copied: uiLanguage === "vi" ? "Đã chép!" : "Copied!",
    autoPublishTitle: uiLanguage === "vi" ? "Tự Động Xuất Bản" : "Auto-Publish Episodes",
    autoPublishDesc: uiLanguage === "vi" 
      ? "Khi bật, mỗi khi bạn tạo một bản tin mới, hệ thống sẽ tự động chuyển đổi thành podcast và tải lên Supabase Storage."
      : "When active, creating a new briefing automatically compiles, uploads, and appends it to your cloud podcast feed.",
    manualPublishTitle: uiLanguage === "vi" ? "Xuất Bản Thủ Công" : "Manual Publish Episode",
    selectBriefing: uiLanguage === "vi" ? "-- Chọn một bản tin từ lịch sử để xuất bản --" : "-- Select a briefing from history to publish --",
    publishBtn: uiLanguage === "vi" ? "Đăng Lên Kênh" : "Publish to Cloud",
    publishingBtn: uiLanguage === "vi" ? "Đang xuất bản..." : "Publishing...",
    listTitle: uiLanguage === "vi" ? "Danh sách tập đã xuất bản" : "Published Episodes",
    episodeCount: uiLanguage === "vi" ? "tập" : "episodes",
    noEpisodes: uiLanguage === "vi" ? "Chưa có tập podcast nào được xuất bản lên mây." : "No podcast episodes published to the cloud yet.",
    deleteConfirm: uiLanguage === "vi" ? "Bạn có chắc chắn muốn gỡ tập podcast này?" : "Are you sure you want to unpublish this episode?",
    guideTitle: uiLanguage === "vi" ? "Hướng dẫn cấu hình Supabase Cloud" : "Supabase Cloud Integration Guide",
    guideStep1: uiLanguage === "vi" ? "1. Tạo Storage Bucket" : "1. Create Storage Bucket",
    guideStep1Body: uiLanguage === "vi" 
      ? "Đăng nhập vào bảng điều khiển Supabase, điều hướng đến Storage, tạo mới một bucket có tên chính xác là \"podcast-audio\". Hãy bật tùy chọn Public Bucket."
      : "Log in to your Supabase dashboard, go to Storage, and create a new bucket named exactly \"podcast-audio\". Ensure \"Public Bucket\" is checked.",
    guideStep2: uiLanguage === "vi" ? "2. Cài đặt RLS Policy (Chính sách truy cập)" : "2. Configure RLS Access Policies",
    guideStep2Body: uiLanguage === "vi"
      ? "Trong cài đặt Bucket \"podcast-audio\" > Policies, thêm chính sách mới để cho phép mọi người (Public/Anon) có quyền SELECT (đọc) tệp âm thanh công khai và quyền INSERT (tải lên) tệp mới."
      : "Within \"podcast-audio\" bucket settings > Policies, add new policies allowing Public/Anon clients SELECT (read) access for public audios and INSERT (upload) access for new files.",
    guideStep3: uiLanguage === "vi" ? "3. Điền cấu hình môi trường" : "3. Fill Environment Variables",
    guideStep3Body: uiLanguage === "vi"
      ? "Đảm bảo biến môi trường SUPABASE_URL và SUPABASE_ANON_KEY đã được định nghĩa trong Settings/Environment của bạn để hệ thống kết nối tự động."
      : "Verify that SUPABASE_URL and SUPABASE_ANON_KEY environment variables are populated in your project Settings/Environment to allow automatic sync."
  };

  const getRssUrl = () => {
    if (typeof window === "undefined") return "/api/podcast/feed";
    return `${window.location.protocol}//${window.location.host}/api/podcast/feed`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getRssUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-6" id="podcast-manager-container">
      {/* Title block */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-cyan-50 text-cyan-600 rounded-xl shrink-0">
          <Podcast className="w-6 h-6 animate-pulse" />
        </div>
        <div className="text-left">
          <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
            <span>{t.title}</span>
            <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase font-black animate-pulse">
              Podcast RSS Live
            </span>
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 font-medium leading-relaxed">
            {t.desc}
          </p>
        </div>
      </div>

      {/* Copy RSS Link Row */}
      <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-[11px] text-slate-600">
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[10px] font-bold text-slate-400 font-sans uppercase mb-1">{t.rssLabel}</p>
          <span className="truncate select-all bg-white px-3 py-1.5 rounded-lg border border-slate-200 block text-xs text-slate-700 font-mono">
            {getRssUrl()}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => handleCopyLink()}
            className={`px-3 py-2 ${copied ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-slate-200 hover:bg-slate-300 text-slate-700"} rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 min-h-[38px]`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{t.copied}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{t.copyBtn}</span>
              </>
            )}
          </button>
          <a
            href="/api/podcast/feed"
            target="_blank"
            rel="noreferrer"
            className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900 rounded-xl transition-all flex items-center justify-center min-w-[38px] min-h-[38px]"
            title="Open XML Raw Feed"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Auto Publish Switch */}
      <div className="bg-cyan-50/40 border border-cyan-100 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="text-left flex-1">
          <h4 className="text-xs font-bold text-cyan-900 flex items-center gap-1.5 uppercase tracking-wide">
            <Radio className="w-4 h-4 text-cyan-600" />
            <span>{t.autoPublishTitle}</span>
          </h4>
          <p className="text-[11px] text-cyan-750/90 mt-1 leading-relaxed font-medium">
            {t.autoPublishDesc}
          </p>
        </div>
        <div className="shrink-0 self-end sm:self-auto">
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={isAutoPublish} 
              onChange={(e) => setIsAutoPublish(e.target.checked)}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
          </label>
        </div>
      </div>

      {/* Manual Publish Action */}
      <div className="border-t border-slate-200/60 pt-5 text-left">
        <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5" />
          <span>{t.manualPublishTitle}</span>
        </h4>
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <select
            value={selectedBriefId}
            onChange={(e) => setSelectedBriefId(e.target.value)}
            className="flex-1 min-w-0 bg-slate-50 border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none font-semibold cursor-pointer text-slate-700 min-h-[44px]"
          >
            <option value="">{t.selectBriefing}</option>
            {savedBriefings.map((brief) => {
              const isPublished = podcastEpisodes.some(ep => ep.id === brief.id);
              const pubBadge = isPublished ? (uiLanguage === "vi" ? " [Đã Live]" : " [Live]") : "";
              return (
                <option key={brief.id} value={brief.id}>
                  {brief.payload?.title || brief.id} ({brief.timestamp}){pubBadge}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            onClick={() => onPublishPodcast(selectedBriefId)}
            disabled={isPublishingPodcast || !selectedBriefId}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap tracking-wide cursor-pointer transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
              isPublishingPodcast
                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                : !selectedBriefId
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm hover:shadow active:scale-[0.98]"
            }`}
          >
            <span>{isPublishingPodcast ? t.publishingBtn : t.publishBtn}</span>
          </button>
        </div>
        {podcastError && (
          <p className="text-[10px] text-rose-600 font-semibold mt-1.5 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{podcastError}</span>
          </p>
        )}
      </div>

      {/* Published Episodes Feed list */}
      <div className="border-t border-slate-200/60 pt-5 flex flex-col gap-3 text-left">
        <div className="flex justify-between items-center text-xs font-bold text-slate-700">
          <span className="uppercase tracking-wide">{t.listTitle}</span>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 font-mono text-slate-500 font-bold border border-slate-150">
            {podcastEpisodes.length} {t.episodeCount}
          </span>
        </div>

        {podcastEpisodes.length === 0 ? (
          <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center gap-1.5">
            <Radio className="w-5 h-5 text-slate-350" />
            <p className="text-[11px] font-medium">{t.noEpisodes}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 max-h-[250px] overflow-y-auto pr-1">
            {podcastEpisodes.map((ep) => {
              const fileName = ep.audioUrl.split("/").pop();
              return (
                <div
                  key={ep.id}
                  className="py-3 px-4 bg-slate-50/60 border border-slate-200 hover:border-slate-250 hover:bg-slate-50 rounded-xl transition flex justify-between items-center gap-3 text-left animate-fade-in"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-800 truncate">
                      {ep.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[9px] text-slate-500 font-semibold font-mono">
                      <span className="truncate max-w-[140px] bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-600">
                        {fileName}
                      </span>
                      <span>•</span>
                      <span>🕒 {new Date(ep.pubDate).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>⌛ {ep.duration}s</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={ep.audioUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 shrink-0"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Play</span>
                    </a>
                    <button
                      type="button"
                      onClick={(e) => onDeletePodcastEpisode(ep.id, e)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                      title="Unpublish Episode"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Supabase integration instruction accordion */}
      <div className="border-t border-slate-200/60 pt-4 text-left">
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center justify-between w-full py-2 text-slate-600 hover:text-slate-800 text-xs font-bold uppercase tracking-wider cursor-pointer"
        >
          <div className="flex items-center gap-1.5 text-cyan-700">
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>{t.guideTitle}</span>
          </div>
          {showGuide ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        </button>

        {showGuide && (
          <div className="mt-3 bg-slate-50 border border-slate-150 p-4 rounded-xl flex flex-col gap-3 text-slate-600 leading-relaxed text-xs">
            <div>
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                {t.guideStep1}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 ml-3 font-medium">
                {t.guideStep1Body}
              </p>
            </div>
            <div>
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                {t.guideStep2}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 ml-3 font-medium font-mono bg-white p-2 rounded border border-slate-200/60 overflow-x-auto whitespace-pre-wrap">
                {uiLanguage === "vi" 
                  ? "✓ Policy for SELECT: Allow public read access (All users/Anon)\n✓ Policy for INSERT: Allow upload access (All users or Authenticated)"
                  : "✓ Policy for SELECT: Allow public read access (All users/Anon)\n✓ Policy for INSERT: Allow upload access (All users or Authenticated)"}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 ml-3 font-medium">
                {t.guideStep2Body}
              </p>
            </div>
            <div className="border-t border-slate-200 pt-2.5">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                {t.guideStep3}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 ml-3 font-medium">
                {t.guideStep3Body}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
