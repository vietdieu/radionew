import React, { useEffect, useState } from "react";
import { 
  Facebook, 
  Twitter, 
  Linkedin, 
  Mail, 
  Copy, 
  Check, 
  Download, 
  Share2, 
  X,
  MessageSquare,
  ExternalLink
} from "lucide-react";
import { getBriefing, incrementBriefingShares } from "../services/storageService";
import { generateCoverImage, saveSharedBriefing } from "../services/shareService";
import { SavedSummary } from "../types";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  briefingId: string;
  uiLanguage: "vi" | "en";
  onShareSuccess?: () => void;
}

const modalTranslations = {
  vi: {
    title: "Chia sẻ bản tin hành trình",
    subtitle: "Lan tỏa bản tin phát thanh cá nhân hóa của bạn lên mạng xã hội.",
    preparing: "Đang chuẩn bị link chia sẻ và ảnh bìa...",
    copyBtn: "Sao chép link",
    copied: "Đã copy thành công!",
    webShareBtn: "Chia sẻ qua hệ thống thiết bị",
    downloadCover: "Tải ảnh bìa (Thumbnail)",
    closeBtn: "Đóng",
    errorLoading: "Không thể tải thông tin bản tin để chia sẻ.",
    linkSection: "Đường dẫn liên kết duy nhất",
    platformsSection: "Chia sẻ trực tiếp lên các nền tảng"
  },
  en: {
    title: "Share Commute Briefing",
    subtitle: "Share your personalized radio news broadcast on social media.",
    preparing: "Generating unique share link and cover art...",
    copyBtn: "Copy Link",
    copied: "Link Copied!",
    webShareBtn: "Use System Share",
    downloadCover: "Download Cover Image",
    closeBtn: "Close",
    errorLoading: "Failed to load briefing information for sharing.",
    linkSection: "Unique shareable link",
    platformsSection: "Share directly to social platforms"
  }
};

export default function ShareModal({
  isOpen,
  onClose,
  briefingId,
  uiLanguage,
  onShareSuccess
}: ShareModalProps) {
  const t = modalTranslations[uiLanguage];
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [briefing, setBriefing] = useState<SavedSummary | null>(null);
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [shareUrl, setShareUrl] = useState<string>("");

  useEffect(() => {
    if (!isOpen || !briefingId) return;

    async function loadShareData() {
      setLoading(true);
      try {
        // 1. Fetch briefing data
        const brief = await getBriefing(briefingId);
        if (!brief) {
          setLoading(false);
          return;
        }
        setBriefing(brief);

        // 2. Save/register shared briefing on server and get unique URL
        const generatedUrl = await saveSharedBriefing(brief);
        setShareUrl(generatedUrl);

        // 3. Increment briefing share count locally
        await incrementBriefingShares(briefingId);
        if (onShareSuccess) {
          onShareSuccess();
        }

        // 4. Generate cover art thumbnail
        const formattedDate = brief.timestamp || new Date().toLocaleDateString(
          uiLanguage === "vi" ? "vi-VN" : "en-US",
          { year: 'numeric', month: 'long', day: 'numeric' }
        );
        const imgDataUrl = await generateCoverImage(brief.payload.title || "Custom Commutecast Briefing", formattedDate);
        setCoverUrl(imgDataUrl);

      } catch (err) {
        console.error("Failed to initialize share details:", err);
      } finally {
        setLoading(false);
      }
    }

    loadShareData();
  }, [isOpen, briefingId, uiLanguage]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: briefing?.title || "CommuteCast Briefing",
          text: uiLanguage === "vi" ? `Nghe bản tin phát thanh CommuteCast: ${briefing?.title}` : `Listen to my CommuteCast: ${briefing?.title}`,
          url: shareUrl,
        });
      } catch (err) {
        console.warn("Web Share API error or cancelled:", err);
      }
    }
  };

  const handleDownloadCover = () => {
    if (!coverUrl) return;
    const a = document.createElement("a");
    a.href = coverUrl;
    a.download = `CommuteCast_${briefingId}_Cover.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Platform specific sharing links
  const briefingTitle = briefing?.title || "CommuteCast Briefing";
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(briefingTitle);

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    zalo: `https://zalo.me/share?url=${encodedUrl}&title=${encodedTitle}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(
      (uiLanguage === "vi" 
        ? "Nghe bản tin phát thanh cá nhân hóa của tôi trên CommuteCast tại: " 
        : "Listen to my personalized commute radio news on CommuteCast: ") + shareUrl
    )}`
  };

  const openPlatformShare = (url: string) => {
    window.open(url, "_blank", "width=600,height=500,scrollbars=yes,resizable=yes");
  };

  const isWebShareSupported = !!navigator.share;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[999] animate-fade-in" id="share-modal-container">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Share2 className="w-5 h-5 text-cyan-400" />
              <span>{t.title}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">{t.subtitle}</p>
          </div>
          <button 
            onClick={() => onClose()}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/50 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-400 font-mono animate-pulse">{t.preparing}</p>
            </div>
          ) : !briefing ? (
            <div className="text-center py-8">
              <p className="text-sm text-amber-400">{t.errorLoading}</p>
            </div>
          ) : (
            <>
              {/* Cover Image Artwork Preview */}
              {coverUrl && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    📸 Cover Art Artwork Preview
                  </span>
                  <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-md aspect-[1200/630]">
                    <img 
                      src={coverUrl} 
                      alt="Cover Art" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        onClick={() => handleDownloadCover()}
                        className="flex items-center gap-1.5 bg-cyan-400 text-slate-950 hover:bg-cyan-500 font-bold px-4 py-2 rounded-full text-xs transition cursor-pointer shadow-lg"
                      >
                        <Download className="w-4 h-4" />
                        <span>{t.downloadCover}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Link copying Section */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                  🔗 {t.linkSection}
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={shareUrl}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-cyan-300 focus:outline-none"
                  />
                  <button
                    onClick={() => handleCopyLink()}
                    className={`px-5 rounded-xl border flex items-center justify-center gap-2 transition font-bold text-sm cursor-pointer ${
                      copied 
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        : "bg-cyan-400 border-transparent text-slate-950 hover:bg-cyan-500"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 animate-bounce" />
                        <span>{t.copied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>{t.copyBtn}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Platforms grid list */}
              <div className="space-y-3">
                <label className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                  🌐 {t.platformsSection}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Zalo */}
                  <button
                    onClick={() => openPlatformShare(shareLinks.zalo)}
                    className="flex items-center gap-3 p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition text-left text-slate-200 cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 group-hover:bg-sky-500/20">
                      <MessageSquare className="w-4 h-4 text-sky-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Zalo</div>
                      <div className="text-[9px] text-slate-500">via zalo.me</div>
                    </div>
                  </button>

                  {/* Facebook */}
                  <button
                    onClick={() => openPlatformShare(shareLinks.facebook)}
                    className="flex items-center gap-3 p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition text-left text-slate-200 cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20">
                      <Facebook className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Facebook</div>
                      <div className="text-[9px] text-slate-500">facebook.com</div>
                    </div>
                  </button>

                  {/* Twitter (X) */}
                  <button
                    onClick={() => openPlatformShare(shareLinks.twitter)}
                    className="flex items-center gap-3 p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition text-left text-slate-200 cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white group-hover:bg-white/10">
                      <Twitter className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Twitter (X)</div>
                      <div className="text-[9px] text-slate-500">x.com</div>
                    </div>
                  </button>

                  {/* LinkedIn */}
                  <button
                    onClick={() => openPlatformShare(shareLinks.linkedin)}
                    className="flex items-center gap-3 p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition text-left text-slate-200 cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20">
                      <Linkedin className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">LinkedIn</div>
                      <div className="text-[9px] text-slate-500">linkedin.com</div>
                    </div>
                  </button>

                  {/* WhatsApp */}
                  <button
                    onClick={() => openPlatformShare(shareLinks.whatsapp)}
                    className="flex items-center gap-3 p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition text-left text-slate-200 cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20">
                      <span className="text-xs font-mono font-bold text-emerald-400">WA</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">WhatsApp</div>
                      <div className="text-[9px] text-slate-500">api.whatsapp</div>
                    </div>
                  </button>

                  {/* Email */}
                  <button
                    onClick={() => { window.location.href = shareLinks.email; }}
                    className="flex items-center gap-3 p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl transition text-left text-slate-200 cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400 group-hover:bg-pink-500/20">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Email</div>
                      <div className="text-[9px] text-slate-500">mailto link</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Web Share (if supported) & Direct Download options */}
              <div className="flex flex-wrap gap-3 pt-3">
                {isWebShareSupported && (
                  <button
                    onClick={() => handleWebShare()}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-white font-bold py-3.5 px-4 rounded-xl text-xs transition cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 text-cyan-400" />
                    <span>{t.webShareBtn}</span>
                  </button>
                )}
                
                <button
                  onClick={() => handleDownloadCover()}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-white font-bold py-3.5 px-4 rounded-xl text-xs transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>{t.downloadCover}</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={() => onClose()}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
          >
            {t.closeBtn}
          </button>
        </div>

      </div>
    </div>
  );
}
