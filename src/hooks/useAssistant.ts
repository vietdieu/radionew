import { useState, useEffect, useCallback, useRef } from "react";
import { z } from "zod";
import { getRSSFeeds } from "../services/storageService";
import { fetchRSSArticles, formatArticlesForPrompt } from "../services/rssService";
import { getTopPreferences } from "../services/preferenceService";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Array<{ title: string; uri: string }>;
  suggestedTopics?: Array<{ topic: string; reason: string }>;
  isActionExecuted?: boolean;
}

interface UseAssistantProps {
  uiLanguage: "vi" | "en";
  getApiUrl: (path: string) => string;
  handleCreateNews: (topic: string) => Promise<void> | void;
  newsContent: string;
  setNewsContent: (content: string) => void;
  isDrivingMode?: boolean;
}

// Zod validation schema for safe parsing of model responses
const AssistantResponseSchema = z.object({
  speechResponse: z.string().default(""),
  suggestedTopics: z.array(
    z.object({
      topic: z.string(),
      reason: z.string(),
    })
  ).default([]),
  action: z.object({
    type: z.string().default("none"),
    param: z.string().optional().default(""),
  }).optional().default({ type: "none", param: "" }),
});

export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

/**
 * Safely parses the JSON output from the Gemini/Groq language model.
 * Handles code fences, removes leading/trailing noise, maps legacy fields, and validates using Zod.
 */
export function parseAssistantResponse(rawText: string): AssistantResponse {
  try {
    let cleaned = rawText.trim();
    
    // 1. Strip markdown code blocks if any
    if (cleaned.startsWith("```")) {
      const firstNewline = cleaned.indexOf("\n");
      if (firstNewline !== -1) {
        cleaned = cleaned.substring(firstNewline + 1);
      } else {
        cleaned = cleaned.substring(3);
      }
      
      if (cleaned.endsWith("```")) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
      }
      cleaned = cleaned.trim();
    }

    // 2. Locate first '{' and last '}' to extract the pure JSON object
    const startIdx = cleaned.indexOf("{");
    const endIdx = cleaned.lastIndexOf("}");
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1);
    }

    const parsed = JSON.parse(cleaned);

    // Legacy "answer" field compatibility mapping
    if (!parsed.speechResponse && parsed.answer) {
      parsed.speechResponse = parsed.answer;
    }

    return AssistantResponseSchema.parse(parsed);
  } catch (error) {
    console.warn("[parseAssistantResponse] Safe JSON parsing failed. Returning robust fallback:", error, rawText);
    return {
      speechResponse: "I am unable to generate recommendations right now. Please try again later.",
      suggestedTopics: [],
      action: { type: "none", param: "" },
    };
  }
}

export function useAssistant({
  uiLanguage,
  getApiUrl,
  handleCreateNews,
  newsContent,
  setNewsContent,
  isDrivingMode = false,
}: UseAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState("");

  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = uiLanguage === "vi" ? "vi-VN" : "en-US";

      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);
      rec.onerror = (event: any) => {
        console.error("[useAssistant] Speech recognition error:", event.error);
        setIsListening(false);
        setErrorMsg(
          uiLanguage === "vi"
            ? "Lỗi micro hoặc không nhận diện được giọng nói."
            : "Microphone error or speech not recognized."
        );
      };

      rec.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript && transcript.trim() !== "") {
          await handleSendMessage(transcript);
        }
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [uiLanguage]);

  // Handle updates to speech recognition language
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = uiLanguage === "vi" ? "vi-VN" : "en-US";
    }
  }, [uiLanguage]);

  // Helper to read responses out loud using the native Speech Synthesis API
  const speakRecommendation = useCallback(
    (text: string) => {
      if (!ttsEnabled || typeof window === "undefined" || !window.speechSynthesis) {
        console.warn("[speakRecommendation] Speech Synthesis not supported or disabled.");
        return;
      }

      // Cancel any ongoing speaking task to prevent overlap
      window.speechSynthesis.cancel();

      // Clean text of markdown characters to ensure smooth speech
      const plainText = text
        .replace(/[\*\_~`#\-+>]/g, "")
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");

      const utterance = new SpeechSynthesisUtterance(plainText);
      utterance.lang = uiLanguage === "vi" ? "vi-VN" : "en-US";

      const voices = window.speechSynthesis.getVoices();
      const targetLang = uiLanguage === "vi" ? "vi" : "en";
      const voice = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith(targetLang) &&
          (v.name.includes("Google") || v.name.includes("Neural"))
      ) || voices.find((v) => v.lang.toLowerCase().startsWith(targetLang));

      if (voice) {
        utterance.voice = voice;
      }

      speechUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [ttsEnabled, uiLanguage]
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Trigger auto-speak if in Driving Mode and window receives recommendations
  const handleAutoSpeak = useCallback((text: string) => {
    if (isDrivingMode) {
      speakRecommendation(text);
    }
  }, [isDrivingMode, speakRecommendation]);

  // Handle RSS actions
  const handleRssAction = useCallback(async () => {
    try {
      setIsProcessing(true);
      setErrorMsg(null);

      const loadingMessageId = Math.random().toString();
      setMessages((prev) => [
        ...prev,
        {
          id: loadingMessageId,
          role: "assistant",
          content:
            uiLanguage === "vi"
              ? "Đang quét các nguồn tin RSS của bạn..."
              : "Scanning your RSS feeds...",
          timestamp: new Date(),
        },
      ]);

      const feeds = await getRSSFeeds();
      if (!feeds || feeds.length === 0) {
        const text =
          uiLanguage === "vi"
            ? "Bạn chưa đăng ký nguồn tin RSS nào. Hãy thêm nguồn tin ở mục RSS!"
            : "You haven't subscribed to any RSS feeds yet. Please add sources in the RSS section!";
        setMessages((prev) =>
          prev.map((msg) => (msg.id === loadingMessageId ? { ...msg, content: text } : msg))
        );
        setIsProcessing(false);
        speakRecommendation(text);
        return;
      }

      const articles = await fetchRSSArticles(feeds, getApiUrl);
      if (!articles || articles.length === 0) {
        const text =
          uiLanguage === "vi"
            ? "Không tìm thấy bài viết mới nào từ các nguồn RSS của bạn."
            : "No new articles found from your RSS sources.";
        setMessages((prev) =>
          prev.map((msg) => (msg.id === loadingMessageId ? { ...msg, content: text } : msg))
        );
        setIsProcessing(false);
        speakRecommendation(text);
        return;
      }

      const topArticles = articles.slice(0, 10);
      const formattedContext = formatArticlesForPrompt(topArticles, uiLanguage);

      const response = await fetch(getApiUrl("/api/assistant-chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:
            uiLanguage === "vi"
              ? `Tóm tắt các bài viết RSS sau đây:\n\n${formattedContext}`
              : `Summarize the following RSS articles:\n\n${formattedContext}`,
          history: [],
          language: uiLanguage,
          userPreferences: [],
        }),
      });

      if (!response.ok) {
        throw new Error("RSS API call failed");
      }

      const rawData = await response.json();
      const validatedData = parseAssistantResponse(JSON.stringify(rawData));

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessageId
            ? {
                ...msg,
                content: validatedData.speechResponse,
                suggestedTopics: validatedData.suggestedTopics,
                timestamp: new Date(),
              }
            : msg
        )
      );

      speakRecommendation(validatedData.speechResponse);
      handleAutoSpeak(validatedData.speechResponse);
    } catch (err: any) {
      console.error("[useAssistant] RSS error:", err);
      setErrorMsg(
        uiLanguage === "vi"
          ? "Không thể tóm tắt tin RSS vào lúc này. Vui lòng thử lại sau."
          : "Unable to summarize RSS feeds at this time. Please try again later."
      );
    } finally {
      setIsProcessing(false);
    }
  }, [uiLanguage, getApiUrl, speakRecommendation, handleAutoSpeak]);

  // Core messaging dispatcher
  const handleSendMessage = async (text: string) => {
    if (!text || text.trim() === "") return;

    setErrorMsg(null);
    setInputVal("");
    stopSpeaking();

    const userMessage: ChatMessage = {
      id: Math.random().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setIsProcessing(true);

    try {
      // Retrieve Top 5 preferences from IndexedDB in the background
      const topPrefs = await getTopPreferences(5);
      const preferencesPayload = topPrefs.map((pref) => pref.topic);

      const response = await fetch(getApiUrl("/api/assistant-chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: updatedHistory.slice(-6).map((msg) => ({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.content,
          })),
          language: uiLanguage,
          userPreferences: preferencesPayload,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Request failed");
      }

      const rawJson = await response.json();
      const validatedData = parseAssistantResponse(JSON.stringify(rawJson));

      const assistantMessage: ChatMessage = {
        id: Math.random().toString(),
        role: "assistant",
        content: validatedData.speechResponse,
        suggestedTopics: validatedData.suggestedTopics || [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Speak & Handle Auto Speak in Driving Mode
      speakRecommendation(validatedData.speechResponse);
      handleAutoSpeak(validatedData.speechResponse);

      // Actions Processing
      const action = validatedData.action || { type: "none", param: "" };
      if (action.type !== "none") {
        const actionType = action.type;
        const actionParam = action.param || "";

        if (actionType === "create_news") {
          const topic = actionParam || text;
          setMessages((prev) => [
            ...prev,
            {
              id: Math.random().toString(),
              role: "assistant",
              content:
                uiLanguage === "vi"
                  ? `🚀 Đang chuẩn bị kịch bản phát thanh về chủ đề: "${topic}"...`
                  : `🚀 Generating radio script for: "${topic}"...`,
              timestamp: new Date(),
              isActionExecuted: true,
            },
          ]);
          await handleCreateNews(topic);
        } else if (actionType === "add_to_news") {
          const separator = newsContent ? "\n\n---\n\n" : "";
          setNewsContent(newsContent + separator + validatedData.speechResponse);

          setMessages((prev) => [
            ...prev,
            {
              id: Math.random().toString(),
              role: "assistant",
              content:
                uiLanguage === "vi"
                  ? "✅ Đã thêm phản hồi trên vào kịch bản bản tin của bạn!"
                  : "✅ Successfully added the response above to your broadcast script!",
              timestamp: new Date(),
              isActionExecuted: true,
            },
          ]);
        } else if (actionType === "read_rss") {
          await handleRssAction();
        }
      }
    } catch (err: any) {
      console.error("[useAssistant] API error:", err);
      let errMsg =
        uiLanguage === "vi"
          ? "Đã xảy ra lỗi khi kết nối với máy chủ trợ lý ảo. Vui lòng thử lại sau."
          : "An error occurred while connecting to the assistant server. Please try again.";

      if (err.message && err.message.includes("quota")) {
        errMsg =
          uiLanguage === "vi"
            ? "Hết hạn ngạch (Quota Limit) gọi API. Hãy thử lại sau nhé."
            : "API Quota Limit exceeded. Please retry later.";
      }

      setErrorMsg(errMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const startListening = () => {
    if (recognitionRef.current) {
      setErrorMsg(null);
      stopSpeaking();
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn("[useAssistant] Recognition start error:", err);
      }
    } else {
      setErrorMsg(
        uiLanguage === "vi"
          ? "Trình duyệt của bạn không hỗ trợ nhận diện giọng nói."
          : "Your browser does not support Speech Recognition."
      );
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const clearChat = () => {
    stopSpeaking();
    setMessages([]);
    setErrorMsg(null);
  };

  return {
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
    sendMessage: handleSendMessage,
    clearChat,
    stopSpeaking,
    speakRecommendation,
  };
}
export default useAssistant;
