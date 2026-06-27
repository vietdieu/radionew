// src/components/VoiceSearch.tsx
import React, { useState, useEffect } from "react";
import { Mic, MicOff, X, Sparkles, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

interface VoiceSearchProps {
  uiLanguage: "vi" | "en";
  newsContent: string;
  setNewsContent: (content: string) => void;
  getApiUrl: (endpoint: string) => string;
}

const t = {
  vi: {
    title: "🎤 Tìm Kiếm Bằng Giọng Nói & Trợ Lý",
    desc: "Hỏi đáp kiến thức, tin tức mới bằng giọng nói (ví dụ: 'thời tiết hôm nay', 'xu hướng công nghệ năm nay'). Bạn có thể thêm trực tiếp kết quả vào bản tin phát thanh phát sóng.",
    btnStart: "Bắt đầu thu âm",
    btnListening: "Đang nghe... nói đi nào",
    processing: "Đang suy nghĩ xử lý...",
    success: "Đã tìm kiếm thành công!",
    errorNotFound: "Không hiểu giọng nói hoặc micro bị tắt.",
    notSupported: "Trình duyệt chưa hỗ trợ ghi âm.",
    answerLabel: "💡 Câu trả lời từ trợ lý:",
    addToBriefing: "Thêm vào kịch bản bản tin",
    ignore: "Hủy bỏ",
    close: "Đóng",
    languageLabel: "Ngôn ngữ nói của bạn:",
    langVi: "Tiếng Việt (vi-VN)",
    langEn: "Tiếng Anh (en-US)",
  },
  en: {
    title: "🎤 Voice Search & Smart Assistant",
    desc: "Ask general knowledge or news questions verbally (e.g. 'tell me about black holes', 'latest trends in tech'). You can directly append response to your broadcast script.",
    btnStart: "Start Speaking",
    btnListening: "Listening... speak now",
    processing: "Thinking and processing...",
    success: "Query answered successfully!",
    errorNotFound: "Speech not recognized or mic permissions disabled.",
    notSupported: "Speech recognition not fully supported on this browser.",
    answerLabel: "💡 Assistant's Answer:",
    addToBriefing: "Add to broadcast script",
    ignore: "Dismiss",
    close: "Close",
    languageLabel: "Your speaking language:",
    langVi: "Vietnamese (vi-VN)",
    langEn: "English (en-US)",
  }
};

export default function VoiceSearch({ uiLanguage, newsContent, setNewsContent, getApiUrl }: VoiceSearchProps) {
  const lang = uiLanguage === "vi" ? t.vi : t.en;
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceInputLanguage, setVoiceInputLanguage] = useState<"vi-VN" | "en-US">("vi-VN");
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<{ answer: string; sources?: Array<{ title: string; uri: string }> } | null>(null);
  const [error, setError] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStatus("");
      setResult(null);
      setError("");
      setIsListening(false);
      setIsProcessing(false);
    }
  }, [isOpen]);

  const startVoiceSearch = () => {
    setError("");
    setStatus("");
    setResult(null);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(lang.notSupported);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = voiceInputLanguage;
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setStatus(lang.btnListening);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        setError(lang.errorNotFound);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (!transcript || transcript.trim() === "") {
          setError(lang.errorNotFound);
          return;
        }

        try {
          setIsProcessing(true);
          setStatus(lang.processing);
          
          const response = await fetch(getApiUrl("/api/voice-query"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: transcript,
              language: voiceInputLanguage === "vi-VN" ? "vi" : "en"
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Query request failed");
          }

          const data = await response.json();
          if (data.answer) {
            setResult({ answer: data.answer, sources: data.sources || [] });
            setStatus(lang.success);
          } else {
            setError(uiLanguage === "vi" ? "Trợ lý không tìm được câu trả lời phù hợp. Hãy thử hỏi lại nhé!" : "Could not find a relevant answer. Try asking again!");
          }
        } catch (err: any) {
          console.error("Voice processing error:", err);
          setError(err.message || "Failed to parse query");
        } finally {
          setIsProcessing(false);
        }
      };

      recognition.start();
    } catch (e: any) {
      console.error("Failed to start Speech Recognition:", e);
      setError(lang.notSupported);
    }
  };

  const handleAddToBriefing = () => {
    if (result && result.answer) {
      const separator = newsContent ? "\n\n---\n\n" : "";
      setNewsContent(newsContent + separator + result.answer);
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Nút mở modal - luôn hiển thị */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-md hover:shadow-lg flex items-center justify-center"
        title={uiLanguage === "vi" ? "Tìm kiếm bằng giọng nói" : "Voice Search"}
        aria-label="Voice Search"
      >
        <Mic className="w-5 h-5" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white"></span>
      </button>

      {/* Modal overlay - phủ toàn màn hình */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md mx-auto shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">{lang.title}</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label={lang.close}
              >
                <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {lang.desc}
              </p>

              {/* Language selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {lang.languageLabel}
                </span>
                <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setVoiceInputLanguage("vi-VN")}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer select-none ${
                      voiceInputLanguage === "vi-VN"
                        ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs border border-indigo-100 dark:border-indigo-800"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                    }`}
                  >
                    🇻🇳 {lang.langVi}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceInputLanguage("en-US")}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer select-none ${
                      voiceInputLanguage === "en-US"
                        ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs border border-indigo-100 dark:border-indigo-800"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                    }`}
                  >
                    🇺🇸 {lang.langEn}
                  </button>
                </div>
              </div>

              {/* Control button */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => startVoiceSearch()}
                  disabled={isProcessing}
                  className={`flex-1 py-3 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer select-none active:scale-[0.97] ${
                    isListening
                      ? "bg-rose-500 text-white animate-pulse"
                      : isProcessing
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                      : "bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm"
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      <span>{lang.btnListening}</span>
                    </>
                  ) : isProcessing ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      <span>{lang.processing}</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>{lang.btnStart}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status / Error */}
              {status && !isProcessing && (
                <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {status}
                </p>
              )}
              {error && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg border border-rose-100 dark:border-rose-800 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{error}</span>
                </p>
              )}

              {/* Result */}
              {result && (
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-indigo-100 dark:border-indigo-800 rounded-xl p-3 space-y-3">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block">
                    {lang.answerLabel}
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {result.answer}
                  </p>
                  {result.sources && result.sources.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                        🌐 {uiLanguage === "vi" ? "Nguồn thông tin:" : "Sources:"}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {result.sources.map((src, idx) => (
                          <a
                            key={idx}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-600 dark:text-slate-300 text-[10px] px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 font-medium transition"
                          >
                            <ExternalLink className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                            <span className="max-w-[150px] truncate">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleAddToBriefing()}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-md transition flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{lang.addToBriefing}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        setStatus("");
                      }}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-md transition"
                    >
                      {lang.ignore}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 text-center">
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
              >
                {lang.close} ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}