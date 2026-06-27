import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AudioLines, ArrowLeft, Sparkles, Radio } from "lucide-react";
import { fetchSharedBriefing } from "../services/shareService";
import { SavedSummary } from "../types";
import ManualPcmPlayer from "./ManualPcmPlayer";

interface SharedBriefingPageProps {
  uiLanguage: "vi" | "en";
  setUiLanguage: (lang: "vi" | "en") => void;
}

const pageTranslations = {
  vi: {
    loading: "Đang tải bản tin được chia sẻ...",
    notFound: "Không tìm thấy bản tin phát thanh này.",
    notFoundSub: "Đường liên kết có thể đã hết hạn hoặc không tồn tại.",
    backHome: "Về trang chủ CommuteCast",
    ctaTitle: "Tạo bản tin phát thanh của riêng bạn?",
    ctaSub: "Sử dụng trí tuệ nhân tạo để tóm tắt bài báo và chuyển ngữ kịch bản sang giọng đọc tự nhiên cho hành trình đi làm hàng ngày của bạn.",
    ctaBtn: "Bắt đầu miễn phí ngay",
    tagline: "Đài phát thanh cá nhân hóa hành trình của bạn",
  },
  en: {
    loading: "Loading shared news briefing...",
    notFound: "This broadcast briefing could not be found.",
    notFoundSub: "The link may have expired or is incorrect.",
    backHome: "Go to CommuteCast Home",
    ctaTitle: "Want your own personalized radio show?",
    ctaSub: "Use AI to summarize articles and synthesize highly natural voiceovers tailored perfectly for your daily commute journey.",
    ctaBtn: "Get Started Free",
    tagline: "Your personalized commute news radio station",
  }
};

export default function SharedBriefingPage({ uiLanguage, setUiLanguage }: SharedBriefingPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = pageTranslations[uiLanguage];
  
  const [loading, setLoading] = useState(true);
  const [briefing, setBriefing] = useState<SavedSummary | null>(null);

  useEffect(() => {
    if (!id) return;

    async function getSharedData() {
      setLoading(true);
      try {
        const brief = await fetchSharedBriefing(id);
        if (brief) {
          setBriefing(brief);
        }
      } catch (err) {
        console.error("Failed to load shared briefing on page:", err);
      } finally {
        setLoading(false);
      }
    }

    getSharedData();
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* Header Panel */}
      <header className="bg-slate-900/60 border-b border-slate-800/80 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div 
            onClick={() => navigate("/")}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-amber-300 flex items-center justify-center shadow-lg shadow-cyan-400/20 group-hover:scale-105 transition-transform">
              <AudioLines className="w-6 h-6 text-slate-950 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>CommuteCast</span>
                <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800/60 px-1.5 py-0.5 rounded-full font-bold">
                  SHARE
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5">{t.tagline}</p>
            </div>
          </div>

          {/* Language Selector */}
          <div className="flex bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-xs font-mono font-bold">
            <button
              onClick={() => setUiLanguage("vi")}
              className={`px-2 py-1 rounded transition-colors ${
                uiLanguage === "vi" 
                  ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-slate-950" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              VI
            </button>
            <button
              onClick={() => setUiLanguage("en")}
              className={`px-2 py-1 rounded transition-colors ${
                uiLanguage === "en" 
                  ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-slate-950" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 font-mono text-sm animate-pulse">{t.loading}</p>
          </div>
        ) : !briefing ? (
          <div className="text-center max-w-md mx-auto py-12 px-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-6">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
              <Radio className="w-8 h-8 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">{t.notFound}</h2>
              <p className="text-sm text-slate-400">{t.notFoundSub}</p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-500 hover:to-cyan-600 text-slate-950 font-bold py-3.5 px-6 rounded-2xl transition cursor-pointer shadow-lg shadow-cyan-400/10 active:scale-98"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.backHome}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            {/* Interactive Player Frame */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-1 shadow-2xl backdrop-blur-sm">
              <ManualPcmPlayer
                payload={briefing.payload}
                audioChunks={briefing.audioChunks || []}
                title={briefing.payload.title}
                briefingId={briefing.id}
                uiLanguage={uiLanguage}
                preferencesInfo={`🎙️ Voice: ${
                  briefing.preferences?.voice === "vi-HN" ? "Hanoi Male" : 
                  briefing.preferences?.voice === "vi-HCM" ? "HCM Female" : 
                  briefing.preferences?.voice === "en-UK" ? "UK Male" : "US Female"
                }`}
              />
            </div>

            {/* Call To Action Banner */}
            <div className="bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0d9488]/10 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="space-y-2 max-w-xl text-center md:text-left">
                <h3 className="text-lg font-bold text-white flex items-center justify-center md:justify-start gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
                  <span>{t.ctaTitle}</span>
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t.ctaSub}
                </p>
              </div>
              <button
                onClick={() => navigate("/")}
                className="shrink-0 bg-gradient-to-r from-cyan-400 to-amber-300 hover:from-cyan-500 hover:to-amber-400 text-slate-950 font-bold px-6 py-3.5 rounded-2xl text-xs transition cursor-pointer shadow-md active:scale-95 flex items-center gap-2"
              >
                <span>{t.ctaBtn}</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-6 text-center text-[10px] text-slate-500 font-mono">
        <p>© 2026 CommuteCast Personalized Podcast. Powered by Gemini & Google TTS.</p>
      </footer>
    </div>
  );
}
