import React, { useEffect, useState } from "react";
import { Share2, Check } from "lucide-react";
import { getBriefing, incrementBriefingShares } from "../services/storageService";
import ShareModal from "./ShareModal";

interface ShareButtonProps {
  briefingId: string;
  onShareSuccess?: () => void;
  uiLanguage: "vi" | "en";
}

export default function ShareButton({
  briefingId,
  onShareSuccess,
  uiLanguage
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [shareCount, setShareCount] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch initial shareCount on load
  useEffect(() => {
    let active = true;
    async function loadStats() {
      try {
        const brief = await getBriefing(briefingId);
        if (brief && active) {
          setShareCount(brief.shareCount || 0);
        }
      } catch (err) {
        console.error("Failed to load share counts in button:", err);
      }
    }
    loadStats();
    return () => {
      active = false;
    };
  }, [briefingId, isModalOpen]);

  const handleOpenShare = (e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering card selection click
    setIsModalOpen(true);
  };

  const handleShareSuccess = () => {
    setShareCount(prev => prev + 1);
    if (onShareSuccess) {
      onShareSuccess();
    }
  };

  return (
    <>
      <button
        onClick={(e) => handleOpenShare(e)}
        className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 ${
          copied
            ? "bg-emerald-50 text-emerald-600 border-emerald-200"
            : "bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 border-slate-200 shadow-3xs"
        }`}
        title={uiLanguage === "vi" ? "Chia sẻ bản tin" : "Share briefing"}
      >
        <Share2 className="w-3.5 h-3.5 text-cyan-500" />
        <span className="text-[10px] font-bold">
          {uiLanguage === "vi" ? "Chia sẻ" : "Share"}
        </span>
        {shareCount > 0 && (
          <span className="bg-slate-100 text-[9px] px-1.5 py-0.5 rounded-full font-bold text-slate-500 ml-0.5 border border-slate-200/50">
            {shareCount}
          </span>
        )}
      </button>

      <ShareModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        briefingId={briefingId}
        uiLanguage={uiLanguage}
        onShareSuccess={handleShareSuccess}
      />
    </>
  );
}
