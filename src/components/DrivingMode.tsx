import React from "react";
import { Play, Pause, RotateCcw, RotateCw, X, ShieldAlert } from "lucide-react";
import { motion } from "motion/react";

interface DrivingModeProps {
  key?: string;
  title: string;
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  onPlayPause: () => void;
  onSkip: (seconds: number) => void;
  onScrubberChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExit: () => void;
  uiLanguage?: "vi" | "en";
}

export default function DrivingMode({
  title,
  isPlaying,
  currentTime,
  totalDuration,
  onPlayPause,
  onSkip,
  onScrubberChange,
  onExit,
  uiLanguage = "vi"
}: DrivingModeProps) {

  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const t = {
    vi: {
      modeActive: "CHẾ ĐỘ LÁI XE (DRIVING MODE)",
      safetyWarning: "Tập trung lái xe an toàn",
      exitBtn: "Thoát chế độ lái xe",
      noBriefing: "Chưa có bản tin được chọn để phát",
    },
    en: {
      modeActive: "DRIVING MODE ACTIVE",
      safetyWarning: "Stay focused on safe driving",
      exitBtn: "Exit Driving Mode",
      noBriefing: "No briefing active to play",
    }
  }[uiLanguage];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed inset-0 z-50 bg-[#070b13] text-white flex flex-col justify-between p-4 sm:p-8 select-none overflow-y-auto"
      id="driving-mode-screen"
    >
      {/* Background safe glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[280px] sm:w-[350px] h-[280px] sm:h-[350px] bg-cyan-500/10 rounded-full blur-[80px] sm:blur-[100px] opacity-70" />
        {isPlaying && (
          <motion.div 
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[240px] sm:w-[300px] h-[240px] sm:h-[300px] bg-amber-500/10 rounded-full blur-[70px] sm:blur-[90px] opacity-60"
          />
        )}
      </div>

      {/* Top Bar: Mode Indicator & Exit Button */}
      <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 w-full border-b border-slate-800/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 bg-red-500 rounded-full animate-pulse shrink-0" />
          <div className="text-left">
            <h2 className="text-xs sm:text-sm font-black tracking-widest text-slate-400 font-mono uppercase">
              {t.modeActive}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-bold flex items-center gap-1.5 mt-0.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{t.safetyWarning}</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => onExit()}
          className="flex items-center justify-center gap-2.5 bg-slate-800/90 hover:bg-slate-800 active:bg-slate-700 text-slate-200 hover:text-white px-5 py-3 rounded-2xl border border-slate-700 font-bold text-sm sm:text-base transition duration-200 cursor-pointer shadow-md w-full sm:w-auto min-h-[48px]"
        >
          <X className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{t.exitBtn}</span>
        </button>
      </div>

      {/* Middle Area: Giant Title & Wave visualizer */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center max-w-4xl mx-auto my-4 px-2">
        {title ? (
          <div className="w-full space-y-6">
            {/* Giant title optimized to fit inside container gracefully */}
            <h1 className="text-xl sm:text-3xl md:text-5xl font-black text-white tracking-tight leading-tight line-clamp-4 max-h-[250px] overflow-hidden px-2">
              {title}
            </h1>
            
            {/* Ambient pulse/wave indicator */}
            {isPlaying ? (
              <div className="flex items-center justify-center gap-1.5 h-12 sm:h-16 mb-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [8, 48, 8] }}
                    transition={{
                      duration: 0.8 + i * 0.1,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="w-1.5 sm:w-2.5 bg-gradient-to-t from-cyan-400 to-amber-300 rounded-full"
                  />
                ))}
              </div>
            ) : (
              <div className="h-12 sm:h-16 mb-2 flex items-center justify-center gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="w-1.5 sm:w-2.5 h-2 bg-slate-800 rounded-full" />
                ))}
              </div>
            )}
          </div>
        ) : (
          <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-slate-400 px-4">
            {t.noBriefing}
          </h1>
        )}
      </div>

      {/* Bottom Area: Large Progress Scrubber & giant Controls */}
      <div className="relative z-10 w-full max-w-3xl mx-auto flex flex-col gap-6 sm:gap-8 pb-2">
        {/* Giant Scrubber Input - Touch Target is significantly increased */}
        <div className="flex flex-col gap-2.5">
          <input
            type="range"
            min={0}
            max={totalDuration || 100}
            step={1}
            value={currentTime}
            onChange={onScrubberChange}
            className="w-full h-4 bg-slate-900 rounded-full appearance-none cursor-pointer accent-cyan-400 border border-slate-850"
            style={{ WebkitAppearance: "none" }}
          />
          <div className="flex justify-between items-center text-sm sm:text-lg md:text-xl font-mono text-slate-400 font-extrabold">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* Controls: Giant play/pause with oversized touch targets */}
        <div className="flex items-center justify-center gap-6 sm:gap-12">
          {/* Skip Back 10s button */}
          <button
            onClick={() => onSkip(-10)}
            className="p-4 sm:p-6 text-slate-350 hover:text-white rounded-full bg-slate-900/95 border border-slate-800 hover:bg-slate-800 active:scale-90 transition-all duration-150 cursor-pointer shadow-lg min-w-[56px] min-h-[56px] flex items-center justify-center"
            title="Rewind 10s"
          >
            <RotateCcw className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>

          {/* GIANT PLAY/PAUSE TRIGGER (at least 50% larger, min 80px) */}
          <button
            onClick={() => onPlayPause()}
            className={`p-7 sm:p-10 rounded-full transition-all duration-300 flex items-center justify-center transform active:scale-95 shadow-xl min-w-[80px] min-h-[80px] ${
              isPlaying
                ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 ring-6 sm:ring-8 ring-amber-500/20"
                : "bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 ring-6 sm:ring-8 ring-cyan-500/20"
            }`}
          >
            {isPlaying ? (
              <Pause className="w-10 h-10 sm:w-14 sm:h-14 fill-current" />
            ) : (
              <Play className="w-10 h-10 sm:w-14 sm:h-14 fill-current ml-1.5" />
            )}
          </button>

          {/* Skip Forward 10s button */}
          <button
            onClick={() => onSkip(10)}
            className="p-4 sm:p-6 text-slate-350 hover:text-white rounded-full bg-slate-900/95 border border-slate-800 hover:bg-slate-800 active:scale-90 transition-all duration-150 cursor-pointer shadow-lg min-w-[56px] min-h-[56px] flex items-center justify-center"
            title="Fast Forward 10s"
          >
            <RotateCw className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
