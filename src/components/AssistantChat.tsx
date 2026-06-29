import React, { useEffect, useRef } from "react";
import { 
  MessageSquare, 
  X, 
  Send, 
  Mic, 
  MicOff, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Trash2, 
  AlertCircle, 
  ExternalLink,
  Bot,
  User,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAssistant } from "../hooks/useAssistant";

interface AssistantChatProps {
  uiLanguage: "vi" | "en";
  getApiUrl: (path: string) => string;
  handleCreateNews: (topic: string) => Promise<void> | void;
  newsContent: string;
  setNewsContent: (content: string) => void;
  isDrivingMode?: boolean;
}

const dict = {
  vi: {
    headerTitle: "Trợ Lý Ảo CommuteCast",
    headerStatus: "Trực tuyến • Sẵn sàng hỗ trợ",
    inputPlaceholder: "Hỏi trợ lý hoặc nhập câu lệnh...",
    tooltipTtsOn: "Bật phát giọng nói",
    tooltipTtsOff: "Tắt phát giọng nói",
    tooltipClear: "Xóa hội thoại",
    errTitle: "Lỗi xử lý",
    suggestionTitle: "Gợi ý câu lệnh:",
    suggestCreate: "Tạo bản tin về trí tuệ nhân tạo",
    suggestAdd: "Thêm nội dung này vào bản tin",
    suggestRss: "Tổng hợp tin RSS",
    suggestRecommend: "Tôi nên đọc gì hôm nay?",
    emptyTitle: "Xin chào! 👋",
    emptyDesc: "Tôi là trợ lý ảo đa năng CommuteCast. Bạn có thể trò chuyện bằng văn bản hoặc giọng nói để tạo bản tin, tóm tắt RSS hoặc tra cứu thông tin cá nhân hóa.",
    listening: "Đang nghe... nói đi nào",
    processing: "Trợ lý đang suy nghĩ...",
    sourcesTitle: "Nguồn tham khảo:",
    suggestedTopicsTitle: "💡 Chủ đề gợi ý dành riêng cho bạn:"
  },
  en: {
    headerTitle: "CommuteCast AI Assistant",
    headerStatus: "Online • Ready to help",
    inputPlaceholder: "Ask assistant or type command...",
    tooltipTtsOn: "Enable text-to-speech",
    tooltipTtsOff: "Disable text-to-speech",
    tooltipClear: "Clear chat history",
    errTitle: "Processing error",
    suggestionTitle: "Suggested commands:",
    suggestCreate: "Write a brief news about tech trends",
    suggestAdd: "Add this answer to my script",
    suggestRss: "Summarize RSS",
    suggestRecommend: "What should I read today?",
    emptyTitle: "Hello there! 👋",
    emptyDesc: "I am your CommuteCast voice assistant. Ask me questions, generate custom radio scripts, summarize your RSS news feeds, and much more.",
    listening: "Listening... speak now",
    processing: "Thinking and processing...",
    sourcesTitle: "Reference Sources:",
    suggestedTopicsTitle: "💡 Suggested topics just for you:"
  }
};

export default function AssistantChat({
  uiLanguage,
  getApiUrl,
  handleCreateNews,
  newsContent,
  setNewsContent,
  isDrivingMode = false
}: AssistantChatProps) {
  const t = dict[uiLanguage === "vi" ? "vi" : "en"];
  
  const {
    isOpen,
    setIsOpen,
    messages,
    isListening,
    isProcessing,
    ttsEnabled,
    setTtsEnabled,
    errorMsg,
    inputVal,
    setInputVal,
    startListening,
    stopListening,
    sendMessage,
    clearChat,
    stopSpeaking
  } = useAssistant({
    uiLanguage,
    getApiUrl,
    handleCreateNews,
    newsContent,
    setNewsContent,
    isDrivingMode
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isProcessing, isListening, errorMsg]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (inputVal.trim() !== "") {
      sendMessage(inputVal.trim());
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          stopSpeaking();
        }}
        className={`fixed bottom-6 right-6 z-[100] p-4 rounded-full shadow-2xl transition-all duration-300 transform active:scale-95 cursor-pointer flex items-center justify-center border ${
          isOpen 
            ? "bg-slate-900 border-slate-700 text-cyan-400 hover:bg-slate-800" 
            : "bg-gradient-to-tr from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 border-cyan-400/20 text-white hover:scale-105"
        }`}
        id="assistant-chat-float-btn"
        title={t.headerTitle}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border border-white text-[8px] text-white font-bold items-center justify-center">AI</span>
          </span>
        )}
      </button>

      {/* Floating Chat Drawer Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-24 right-6 z-[100] w-full max-w-sm h-[500px] md:h-[580px] bg-white dark:bg-slate-950 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-fade-in"
            id="assistant-chat-window"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="relative p-2 bg-indigo-500/20 rounded-full border border-indigo-500/30">
                  <Bot className="w-5 h-5 text-cyan-400" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900"></span>
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">{t.headerTitle}</h3>
                  <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                    {t.headerStatus}
                  </span>
                </div>
              </div>

              {/* Header Controls */}
              <div className="flex items-center gap-1.5">
                {/* TTS Speaker Toggle */}
                <button
                  onClick={() => {
                    setTtsEnabled(!ttsEnabled);
                    stopSpeaking();
                  }}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    ttsEnabled ? "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/35" : "text-slate-500 hover:bg-slate-800"
                  }`}
                  title={ttsEnabled ? t.tooltipTtsOff : t.tooltipTtsOn}
                >
                  {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>

                {/* Clear Conversation History */}
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-rose-400 transition-colors cursor-pointer"
                  title={t.tooltipClear}
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Minimize Button */}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    stopSpeaking();
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conversation Messages Box */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/30">
              {messages.length === 0 ? (
                /* Welcome Empty Screen */
                <div className="h-full flex flex-col justify-center items-center text-center p-4 space-y-4 my-auto select-none">
                  <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 rounded-full border border-indigo-500/20 shadow-inner">
                    <Sparkles className="w-10 h-10 text-cyan-600 dark:text-cyan-400 animate-pulse" />
                  </div>
                  <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100">{t.emptyTitle}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-[280px]">
                    {t.emptyDesc}
                  </p>

                  {/* Suggestion Commands */}
                  <div className="w-full text-left space-y-2 pt-2 border-t border-slate-100 dark:border-slate-850">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      {t.suggestionTitle}
                    </span>
                    <div className="grid grid-cols-1 gap-1.5">
                      <button
                        onClick={() => sendMessage(t.suggestRecommend)}
                        className="text-left text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500 dark:hover:border-cyan-500 hover:bg-cyan-50/30 dark:hover:bg-cyan-950/20 p-2.5 rounded-xl text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5 text-cyan-500" />
                        <span>{t.suggestRecommend}</span>
                      </button>
                      <button
                        onClick={() => sendMessage(t.suggestRss)}
                        className="text-left text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500 dark:hover:border-cyan-500 hover:bg-cyan-50/30 dark:hover:bg-cyan-950/20 p-2.5 rounded-xl text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5 text-cyan-500" />
                        <span>{t.suggestRss}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Chat Messages List */
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {/* Avatar */}
                      {msg.role === "assistant" && (
                        <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 text-cyan-400 shrink-0 select-none">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}

                      {/* Bubble */}
                      <div className="flex flex-col max-w-[80%]">
                        <div
                          className={`p-3 rounded-2xl text-xs leading-relaxed font-sans whitespace-pre-wrap shadow-xs ${
                            msg.role === "user"
                              ? "bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white rounded-tr-none shadow-md"
                              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none shadow-sm"
                          }`}
                        >
                          {msg.content}

                          {/* Suggested Topics Rendering as Action Buttons */}
                          {msg.role === "assistant" && msg.suggestedTopics && msg.suggestedTopics.length > 0 && (
                            <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                              <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 block tracking-tight uppercase">
                                {t.suggestedTopicsTitle}
                              </span>
                              <div className="grid grid-cols-1 gap-1.5">
                                {msg.suggestedTopics.map((item, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      setIsOpen(false);
                                      handleCreateNews(item.topic);
                                    }}
                                    className="text-left w-full bg-slate-50 dark:bg-slate-950 hover:bg-cyan-50/20 dark:hover:bg-cyan-950/20 border border-slate-200 dark:border-slate-850 hover:border-cyan-400 dark:hover:border-cyan-700 p-2.5 rounded-xl text-slate-700 dark:text-slate-300 transition-all cursor-pointer flex flex-col gap-0.5 hover:scale-[1.02]"
                                  >
                                    <span className="font-bold text-[11px] text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                                      {uiLanguage === "vi" ? `Phát tin: ${item.topic}` : `Broadcast: ${item.topic}`}
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                      {item.reason}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Sources Grounding Info */}
                          {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1">
                                🌐 {t.sourcesTitle}
                              </span>
                              <div className="flex flex-col gap-1.5">
                                {msg.sources.map((src, idx) => (
                                  <a
                                    key={idx}
                                    href={src.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:underline text-[10px] font-medium"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                    <span className="truncate max-w-[200px]">{src.title}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <span className={`text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-1 ${
                          msg.role === "user" ? "text-right" : "text-left"
                        }`}>
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* User Avatar */}
                      {msg.role === "user" && (
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-400 shrink-0 select-none">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Processing / Generating bubble */}
                  {isProcessing && (
                    <div className="flex gap-2.5 justify-start">
                      <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 text-cyan-400 shrink-0">
                        <Bot className="w-4 h-4 animate-spin-slow" />
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl rounded-tl-none max-w-[80%] flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-500 animate-spin" />
                        <span>{t.processing}</span>
                      </div>
                    </div>
                  )}

                  {/* Listening bubble */}
                  {isListening && (
                    <div className="flex gap-2.5 justify-end">
                      <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 p-3 rounded-2xl rounded-tr-none max-w-[80%] flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 animate-pulse">
                        <MicOff className="w-3.5 h-3.5" />
                        <span>{t.listening}</span>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-rose-500 flex items-center justify-center text-white shrink-0 animate-ping">
                        <Mic className="w-4 h-4" />
                      </div>
                    </div>
                  )}

                  {/* Error Notification */}
                  {errorMsg && (
                    <div className="bg-rose-50 dark:bg-rose-950/25 border border-rose-100 dark:border-rose-900/50 rounded-xl p-3 flex gap-2 items-start shrink-0">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block">
                          {t.errTitle}
                        </span>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                          {errorMsg}
                        </p>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input / Control Area */}
            <div className="p-3 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-2">
              <div className="flex items-center gap-2">
                {/* Voice Record Microphone Trigger */}
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`p-3 rounded-xl transition-all select-none cursor-pointer flex items-center justify-center shrink-0 border ${
                    isListening
                      ? "bg-rose-500 hover:bg-rose-600 border-rose-600 text-white animate-pulse"
                      : "bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                  }`}
                  title={isListening ? "Stop voice listening" : "Start voice search"}
                >
                  <Mic className="w-4 h-4" />
                </button>

                {/* Text Input Field */}
                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t.inputPlaceholder}
                  className="flex-1 px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 focus:bg-white dark:focus:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-cyan-500 dark:focus:border-cyan-500 focus:outline-none transition-all placeholder:text-slate-400 text-slate-800 dark:text-slate-100"
                  disabled={isProcessing}
                />

                {/* Send Button */}
                <button
                  onClick={handleSend}
                  disabled={isProcessing || inputVal.trim() === ""}
                  className={`p-3 rounded-xl transition-all select-none cursor-pointer flex items-center justify-center shrink-0 ${
                    inputVal.trim() === "" || isProcessing
                      ? "bg-slate-100 dark:bg-slate-900 text-slate-400 cursor-not-allowed border border-transparent"
                      : "bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm hover:scale-[1.03]"
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
