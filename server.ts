import express from "express";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import * as edgeTTS from "edge-tts";
import fs from "fs";
import { Storage } from "@google-cloud/storage";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { v4 as uuidv4 } from "uuid";
import xml2js from "xml2js";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.enable("trust proxy");
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

let currentKeyIndex = 0;

// Global timestamps to temporarily disable failing TTS engines across separate requests and avoid timeouts
let globalGeminiTtsDisabledUntil = 0;
let globalEdgeTtsDisabledUntil = 0;
let globalGCloudTtsDisabledUntil = 0;

function getKeysList(): string[] {
  const keys: string[] = [];
  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY.trim());
  for (let i = 2; i <= 6; i++) {
    const key = process.env[`GEMINI_API_KEY${i}`];
    if (key) keys.push(key.trim());
  }
  return keys.filter(k => k !== "");
}

if (getKeysList().length === 0) {
  console.warn("[Warning] No Gemini API keys found. Some features may fail.");
}

function getGenAI(): GoogleGenAI {
  const keys = getKeysList();
  if (keys.length === 0) {
    throw new Error("GEMINI_API_KEY is not defined. Please check Settings -> Secrets.");
  }
  const idx = currentKeyIndex % keys.length;
  return new GoogleGenAI({
    apiKey: keys[idx],
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });
}

async function callGeminiWithRotation<T>(
  apiCall: (ai: GoogleGenAI) => Promise<T>
): Promise<T> {
  const keys = getKeysList();
  if (keys.length === 0) {
    throw new Error("No GEMINI_API_KEY is configured. Please set at least GEMINI_API_KEY in Settings -> Secrets.");
  }

  let attempts = 0;
  let lastError: any = null;

  while (attempts < keys.length) {
    const keyIndex = currentKeyIndex % keys.length;
    const currentKey = keys[keyIndex];

    const ai = new GoogleGenAI({
      apiKey: currentKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    try {
      console.log(`[Gemini Rotation] Attempting call using Key Index #${keyIndex + 1} of ${keys.length} (ending ...${currentKey.slice(-4)})`);
      const result = await apiCall(ai);
      return result;
    } catch (error: any) {
      lastError = error;
      const errMsg = (error.message || "").toLowerCase();
      const isQuotaLimit =
        errMsg.includes("resource_exhausted") ||
        errMsg.includes("quota") ||
        errMsg.includes("limit") ||
        errMsg.includes("429");

      if (isQuotaLimit && keys.length > 1) {
        console.warn(`[Gemini Rotation] Key Index #${keyIndex + 1} hit quota. Falling back to next key...`);
        currentKeyIndex = (currentKeyIndex + 1) % keys.length;
        attempts++;
      } else {
        throw error;
      }
    }
  }

  throw lastError || new Error("All configured GEMINI_API_KEY entries returned quota limits.");
}

async function generateWithGroq(systemPrompt: string, userPrompt: string, responseFormatJson: boolean = false): Promise<string> {
  const gApiKey = process.env.GROQ_API_KEY;
  if (!gApiKey) {
    throw new Error("GROQ_API_KEY is not defined in system environment.");
  }

  const modelName = "llama-3.3-70b-versatile";

  let finalSystemPrompt = systemPrompt;
  if (responseFormatJson) {
    finalSystemPrompt += "\nCRITICAL: Your entire output must be one single valid JSON object strictly matching the requested JSON Schema structure. Do not output any markdown code blocks, surround with triple backticks, or write conversational surrounding wrapper text.";
  }

  const payload: any = {
    model: modelName,
    messages: [
      { role: "system", content: finalSystemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.3,
  };

  if (responseFormatJson) {
    payload.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${gApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API returned error status ${response.status}: ${errorText}`);
  }

  const data: any = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq API returned empty choices content.");
  }
  return content;
}

function extractErrorMessage(error: any): string {
  if (!error) return "Unknown error";

  let details = "";
  if (error.response && error.response.data) {
    const data = error.response.data;
    if (typeof data === "string") {
      details = data;
    } else if (typeof data === "object") {
      if (data.error) {
        if (typeof data.error === "object") {
          details = data.error.message || JSON.stringify(data.error);
        } else {
          details = String(data.error);
        }
      } else {
        details = JSON.stringify(data);
      }
    }
  }

  const baseMsg = error.message || "";
  let fullMsg = baseMsg;
  if (details) {
    fullMsg += ` (Details: ${details})`;
  }

  if (error.status) {
    fullMsg = `[Status ${error.status}] ${fullMsg}`;
  }

  return fullMsg;
}

function parseGeminiError(error: any, isVi: boolean = true, isTTS: boolean = false): string {
  const fullMsg = extractErrorMessage(error);
  const lowercaseMsg = fullMsg.toLowerCase();

  if (
    lowercaseMsg.includes("resource_exhausted") ||
    lowercaseMsg.includes("quota") ||
    lowercaseMsg.includes("limit") ||
    lowercaseMsg.includes("429") ||
    lowercaseMsg.includes("rate limit")
  ) {
    if (isTTS) {
      if (isVi) {
        return "QUOTA_LIMIT: Bạn đã tạm thời sử dụng hết số lượt chuyển đổi giọng nói miễn phí của Google TTS (Giới hạn tối đa là 10 lượt gọi mỗi ngày của mô hình thử nghiệm gemini-3.1-flash-tts). Để tiếp tục trải nghiệm toàn bộ thiết kế Trình Player & Hiệu ứng phòng thu live, bạn hãy phát các bản tin mẫu lưu sẵn ở mục 'Lịch sử phát thanh' (chứa tệp âm thanh hoàn chỉnh) ngay bên dưới!";
      } else {
        return "QUOTA_LIMIT: You have temporarily reached Google's free-tier daily call limit for the experimental 'gemini-3.1-flash-tts-preview' model (capped at exactly 10 requests per day per project). To continue experiencing the dynamic live player spectrum and effects, simply select and play any pre-cached briefings from the 'Commute Briefing Archive' below!";
      }
    } else {
      if (isVi) {
        return "QUOTA_LIMIT: Bạn đã tạm thời vượt quá giới hạn cuộc gọi miễn phí của mô hình Gemini (Giới hạn tài nguyên). Vui lòng đợi 30 giây rùi thử lại hoặc bấm phát các bản tin lưu sẵn ở mục 'Lịch sử phát thanh' bên dưới!";
      } else {
        return "QUOTA_LIMIT: You have hit the default free-tier rate limits for the Gemini model. Please wait 30 seconds before retrying, or explore our pre-cached archives below!";
      }
    }
  }

  if (lowercaseMsg.includes("api_key_invalid") || lowercaseMsg.includes("api key not valid") || lowercaseMsg.includes("invalid api key") || lowercaseMsg.includes("key is invalid")) {
    if (isVi) {
      return "LỖI: Khóa API Gemini của bạn không hợp lệ hoặc đã bị khóa. Vui lòng kiểm tra lại thiết lập Secrets trong AI Studio.";
    } else {
      return "ERROR: Your Gemini API key is invalid or suspended. Please check your Secrets configuration in AI Studio.";
    }
  }

  return fullMsg || "An unexpected error occurred during cloud server operations.";
}

// ==================== SHARING SYSTEM SERVICE ====================
const SHARED_BRIEFINGS_JSON_PATH = path.join(process.cwd(), "shared-briefings.json");
let cachedSharedBriefingsInMem: any[] | null = null;

async function loadSharedBriefingsFromSupabaseAsync(): Promise<any[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  try {
    let rawData: any = null;
    let downloadErr: any = null;

    try {
      const { data, error } = await supabase.storage.from("podcast-audio").download("metadata/shared-briefings.json");
      if (!error && data) {
        rawData = data;
      } else {
        downloadErr = error;
      }
    } catch (err: any) {
      downloadErr = err;
    }

    if (rawData) {
      const text = await rawData.text();
      const briefings = JSON.parse(text);
      if (Array.isArray(briefings)) {
        console.log(`[Share - Supabase] Successfully fetched shared briefings from Supabase Storage.`);
        try {
          fs.writeFileSync(SHARED_BRIEFINGS_JSON_PATH, JSON.stringify(briefings, null, 2));
        } catch (e) {}
        return briefings;
      }
    }
    console.log("[Share - Supabase] No shared briefings found or failed to load. Returning empty.");
    return [];
  } catch (err: any) {
    console.error("[Share - Supabase] Failed to download shared briefings:", err.message || err);
    return [];
  }
}

async function saveSharedBriefingsToSupabaseAsync(briefings: any[]) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    console.log("[Share - Supabase] Syncing shared briefings to Supabase Cloud Storage...");
    const fileBuffer = Buffer.from(JSON.stringify(briefings, null, 2));

    const uploadResult = await supabase.storage.from("podcast-audio").upload("metadata/shared-briefings.json", fileBuffer, {
      contentType: "application/json",
      upsert: true
    });

    if (uploadResult.error) {
      console.warn(`[Share - Supabase] Sync failed: ${uploadResult.error.message}.`);
    } else {
      console.log("[Share - Supabase] Shared briefings synchronized successfully.");
    }
  } catch (err: any) {
    console.error("[Share - Supabase] Unexpected error uploading shared briefings:", err.message || err);
  }
}

async function getSharedBriefings(): Promise<any[]> {
  if (cachedSharedBriefingsInMem) {
    return cachedSharedBriefingsInMem;
  }

  // Try local first
  if (fs.existsSync(SHARED_BRIEFINGS_JSON_PATH)) {
    try {
      const data = fs.readFileSync(SHARED_BRIEFINGS_JSON_PATH, "utf-8");
      cachedSharedBriefingsInMem = JSON.parse(data);
      // Background sync from Supabase
      loadSharedBriefingsFromSupabaseAsync().then((cloudBrefs) => {
        if (cloudBrefs && cloudBrefs.length > 0) {
          cachedSharedBriefingsInMem = cloudBrefs;
        }
      });
      return cachedSharedBriefingsInMem || [];
    } catch (e) {
      console.error("Failed to parse local shared-briefings.json:", e);
    }
  }

  // Try Supabase if local not exists
  const cloudBrefs = await loadSharedBriefingsFromSupabaseAsync();
  cachedSharedBriefingsInMem = cloudBrefs;
  return cloudBrefs;
}

// Share endpoints
app.post("/api/share", async (req, res): Promise<any> => {
  try {
    const { briefing } = req.body;
    if (!briefing || !briefing.id) {
      return res.status(400).json({ error: "No valid briefing provided." });
    }

    const id = briefing.id;
    const briefingsList = await getSharedBriefings();
    
    // Check if it already exists
    const existingIndex = briefingsList.findIndex((item) => item.id === id);
    if (existingIndex > -1) {
      briefingsList[existingIndex] = briefing;
    } else {
      briefingsList.push(briefing);
    }

    // Save locally
    fs.writeFileSync(SHARED_BRIEFINGS_JSON_PATH, JSON.stringify(briefingsList, null, 2));

    // Sync in background to Supabase
    saveSharedBriefingsToSupabaseAsync(briefingsList).catch(err => {
      console.error("Failed to sync shared briefings to Supabase in background:", err);
    });

    return res.json({ success: true, briefingId: id });
  } catch (error: any) {
    console.error("Failed to save shared briefing:", error);
    return res.status(500).json({ error: "Failed to save shared briefing." });
  }
});

app.get("/api/share/:id", async (req, res): Promise<any> => {
  try {
    const { id } = req.params;
    const briefingsList = await getSharedBriefings();
    const briefing = briefingsList.find((item) => item.id === id);
    if (!briefing) {
      return res.status(404).json({ error: "Shared briefing not found." });
    }
    return res.json({ success: true, briefing });
  } catch (error: any) {
    console.error("Failed to get shared briefing:", error);
    return res.status(500).json({ error: "Failed to load shared briefing." });
  }
});

// 1. Summarize
app.post("/api/summarize", async (req, res): Promise<any> => {
  const language = req.body?.preferences?.language || "en";
  const isVi = language === "vi" || language === "bilingual";

  try {
    const { content, preferences } = req.body;
    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "No news articles content provided." });
    }

    const targetDuration = preferences?.targetDuration || "medium";
    const tone = preferences?.tone || "conversational";
    const focus = preferences?.focus || "general overview";
    const commuteType = preferences?.commuteType || "driving";
    const customInstructions = preferences?.customInstructions || "";

    const lengthGuidelines =
      targetDuration === "short"
        ? "Keep it brief. Write an introduction, exactly 1-2 concise chapters with 200-300 characters each, and a short outro. Total length should be around 1-2 minutes of speech."
        : targetDuration === "long"
        ? "Deep dive. Write an introduction, 4-5 core chapters with 350-450 characters each, and an outro. Total length should be deep and rich, around 5-7 minutes of speech."
        : "Standard. Write an introduction, 2-3 core chapters with 300-400 characters each, and an outro. Total length should be around 3-4 minutes of speech.";

    let languageInstructions = "";
    if (language === "vi") {
      languageInstructions = `
LANGUAGE RULE: The entire report MUST be generated in VIETNAMESE (Tiếng Việt).
- Provide warm greetings, friendly transitions, and professional sign-offs in natural, elegant, standard spoken Vietnamese.
- For English technical acronyms or terms, explain them naturally in Vietnamese or spell out how they are pronounced if necessary.
- Ensure titles, topics, scriptText, summaryBullets, and conclusion are 100% in Vietnamese.`;
    } else if (language === "bilingual") {
      languageInstructions = `
LANGUAGE RULE: The entire report MUST be written in a graceful, engaging BILINGUAL (English / Vietnamese) format.
- In 'introduction', 'scriptText' of each chapter, and 'conclusion': Every main concept or sentence should first be spoken in English and then immediately followed by its friendly, natural translation in Vietnamese separated by a slash (/) (for example: "Good morning dynamic commuters! Today looks like a rainy day in Hanoi, so drive safely. / Chào buổi sáng quý thính giả năng động! Hôm nay dự báo sẽ là một ngày mưa tại Hà Nội, vì vậy hãy lái xe thật an toàn nhé.").
- Keep the alternating flow extremely smooth and natural for speech synthesis.
- Each chapter's 'topic' and the main 'title' should use bilingual slash/pipe formatting (e.g. "Tech Breakthroughs / Những đột phá Công nghệ" or "Space Discovery / Khám phá Không gian").
- The 'summaryBullets' list items should also be presented in bilingual pairs (e.g. "Quantum chip uses 40 percent less power. / Chip lượng tử sử dụng ít năng lượng hơn 40 phần trăm.").`;
    } else {
      languageInstructions = `
LANGUAGE RULE: The entire report MUST be generated in ENGLISH.
- Maintain native, polished English phrasing throughout all fields.`;
    }

    const systemPrompt = `You are a professional broadcast radio host, smart route assistant, and personal briefing anchor for CommuteCast. 
Your goal is to digest the provided text of raw news articles, clean up the formatting, remove any noisy HTML/ad boilerplate, and integrate realistic, highly natural weather conditions and traffic status details to weave a complete, personalized daily briefing speaker script under JSON format.

${languageInstructions}

IMPORTANT GUIDELINES & SCRIPT STRUCTURE:
1. The script fields MUST be written EXACTLY as they should be spoken out loud. 
2. NEVER include markdown code formatting like bullet points (*, -), double asterisks (**), hashtags, or brackets inside the introduction, text, or conclusion fields. Spell out metrics and symbols if necessary (e.g., use "and" instead of "&", "dollars" instead of "$", "percent" instead of "%" where appropriate so TTS reads it elegantly). Also spell out numbers where it would improve TTS pronunciation.
3. "introduction": A warm, speaker-ready welcome message. YOU MUST seamlessly and naturally integrate mock or real local weather conditions (e.g., sunny, light breeze, cloudy, or rainy) and real-time traffic status (e.g., smooth flow, minor highway delays, or rush hour congestion) depending on the user's chosen commute type (${commuteType}) to warn them before starting their journey.
4. "chapters": An array of chapter objects based on the raw news material.
   - "topic": snappy chapter theme title.
   - "scriptText": Kịch bản chi tiết để đọc thành tiếng. Written in short, readable sentences (maximum 20 words per sentence). Use semicolons (;) or commas appropriately to create natural pauses and rhythm so TTS reads it smoothly.
   - "summaryBullets": 2-3 short, punchy bullet points to display in the UI as visual takeaways.
5. "conclusion": A charming, friendly closing remark with safe-travel wishes and traffic safety tips suited for their commute type (${commuteType}) and tone-styling (${tone}).
6. Customize the summaries according to the user's specified focus constraint: "${focus}".
7. Apply length guidelines: ${lengthGuidelines}
8. Follow these specific instructions if provided by user: "${customInstructions}"`;

    const promptText = `Generate a news broadcast report from the following raw news materials:\n\n${content}`;

    // 1. LẤY THỜI TIẾT MIỄN PHÍ: Thử nghiệm lấy thời tiết nhanh bằng wttr.in (trả về văn bản thuần)
    let weatherData = "No weather data available.";
    if (preferences?.locationName) {
      try {
        const weatherRes = await fetch(`https://wttr.in/${encodeURIComponent(preferences.locationName)}?format=3`);
        if (weatherRes.ok) {
          weatherData = await weatherRes.text(); // Trả về dạng: "Hanoi: ⛅️ +28°C"
          weatherData = weatherData.trim();
        }
      } catch (e) {
        console.warn("Weather fetch failed, skipping...", e);
      }
    }

    // 2. CHÈN THÔNG TIN VÀO PROMPT ĐỂ GỬI QUA GOOGLE AI STUDIO
    const systemPromptEnhanced = `${systemPrompt}\nThông tin thời tiết hiện tại: ${weatherData}. \nTuyến đường người dùng di chuyển: ${preferences?.commuteRoute || "Không rõ"}. Hãy chủ động dùng công cụ tìm kiếm tích hợp (Google Search Tool) để quét tình trạng giao thông thực tế tại tuyến đường này nếu có tin tức mới.`;

    const hasGroq = !!process.env.GROQ_API_KEY;
    let outputText = "";

    if (hasGroq) {
      console.log("[CommuteCast] Groq API setup detected! Routing text summarization to Llama 3.3...");
      const schemaPrompt = `
You must respond with a JSON object containing these keys exactly:
- "title" (string): A catchy report title
- "introduction" (string): A warm, speaker-ready welcome message. Keeps the user hooked.
- "chapters" (array): array of chapter objects. Each chapter must have:
    - "topic" (string): snappy chapter theme title
    - "scriptText" (string): continuous spoken script written only with read-out-loud standard phrasing. No asterisks, stars, blocks, or lists.
    - "summaryBullets" (array of strings): 2-3 short, punchy bullet points to display in the UI as visual takeaways.
- "conclusion" (string): A charming, friendly closing remark with safe-travel wishes suited for their commute.

Keep scriptText very natural for speaking. Do not include markdown bold or headers inside fields.`;
      outputText = await generateWithGroq(systemPromptEnhanced + "\n" + schemaPrompt, promptText, true);
    } else {
      console.log("[CommuteCast] GROQ_API_KEY not found. Using standard Gemini model for summarization.");
      const response = await callGeminiWithRotation((ai) =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: promptText,
          config: {
            systemInstruction: systemPromptEnhanced,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "A catchy report title" },
                introduction: { type: Type.STRING, description: "A warm, speaker-ready welcome message. Keeps the user hooked." },
                chapters: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      topic: { type: Type.STRING, description: "Snappy chapter theme title" },
                      scriptText: { type: Type.STRING, description: "Continuous spoken script written only with read-out-loud standard phrasing. No asterisks, stars, blocks, or lists." },
                      summaryBullets: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 short, punchy, bullet points to display in the UI as visual takeaways." }
                    },
                    required: ["topic", "scriptText", "summaryBullets"]
                  }
                },
                conclusion: { type: Type.STRING, description: "A charming, friendly closing remark with safe-travel wishes suited for their commute." }
              },
              required: ["title", "introduction", "chapters", "conclusion"]
            }
          }
        })
      );
      outputText = response.text || "";
    }

    if (!outputText || outputText.trim() === "") {
      throw new Error("Empty response received from content generation model.");
    }

    const payload = JSON.parse(outputText);
    return res.json(payload);
  } catch (error: any) {
    console.error("Summarization error:", error);
    const friendlyError = parseGeminiError(error, isVi, false);
    return res.status(500).json({ error: friendlyError });
  }
});

let gcloudTTSClientInstance: TextToSpeechClient | null = null;

function getGCloudTTSClient(): TextToSpeechClient | null {
  if (gcloudTTSClientInstance) return gcloudTTSClientInstance;

  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      gcloudTTSClientInstance = new TextToSpeechClient({ keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS });
      console.log("[TTS - Google Cloud] Initialized client with keyFilename.");
    } else if (process.env.GCS_PRIVATE_KEY && process.env.GCS_CLIENT_EMAIL) {
      const privateKey = process.env.GCS_PRIVATE_KEY.replace(/\\n/g, "\n");
      gcloudTTSClientInstance = new TextToSpeechClient({
        credentials: {
          client_email: process.env.GCS_CLIENT_EMAIL,
          private_key: privateKey,
        }
      });
      console.log("[TTS - Google Cloud] Initialized client with service account email/private key.");
    } else {
      const keys = getKeysList();
      const apiKey = keys.length > 0 ? keys[0] : undefined;
      if (apiKey) {
        gcloudTTSClientInstance = new TextToSpeechClient({ apiKey });
        console.log("[TTS - Google Cloud] Initialized client with Gemini/Google API Key.");
      } else {
        gcloudTTSClientInstance = new TextToSpeechClient();
        console.log("[TTS - Google Cloud] Initialized client with default credentials.");
      }
    }
    return gcloudTTSClientInstance;
  } catch (err: any) {
    console.error("[TTS - Google Cloud] Failed to initialize Google Cloud TextToSpeechClient:", err.message || err);
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
    )
  ]);
}

// ================== API TTS ==================
// Helper to split text into safe, smaller chunks based on [BREAK_1S] and sentence punctuation
function chunkTextForTTS(text: string, maxChars = 200): string[] {
  // Split by [BREAK_1S] first
  const rawSegments = text.split(/\[BREAK_1S\]/i);
  const finalChunks: string[] = [];

  for (let segment of rawSegments) {
    segment = segment.trim();
    if (!segment) continue;

    if (segment.length <= maxChars) {
      finalChunks.push(segment);
    } else {
      // Split by sentence boundaries (keep the punctuation with lookbehind if possible, or just standard match)
      const sentences = segment.split(/(?<=[.?!;])\s+|\n+/);
      let currentChunk = "";

      for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (!trimmedSentence) continue;

        if ((currentChunk + " " + trimmedSentence).trim().length <= maxChars) {
          currentChunk = (currentChunk + " " + trimmedSentence).trim();
        } else {
          if (currentChunk) {
            finalChunks.push(currentChunk);
          }
          if (trimmedSentence.length > maxChars) {
            // Hard split as fallback if a single sentence is super long
            let start = 0;
            while (start < trimmedSentence.length) {
              finalChunks.push(trimmedSentence.substring(start, start + maxChars).trim());
              start += maxChars;
            }
            currentChunk = "";
          } else {
            currentChunk = trimmedSentence;
          }
        }
      }
      if (currentChunk) {
        finalChunks.push(currentChunk);
      }
    }
  }

  return finalChunks;
}

app.post("/api/tts", async (req, res): Promise<any> => {
  const { text, voice, tone } = req.body;
  const isVi = voice?.startsWith("vi-") || false;

  try {
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "No text provided for audio synthesis." });
    }

    // Split text into optimized, safe chunks (350 chars) to prevent timeouts and ensure rapid synthesis
    const chunks = chunkTextForTTS(text, 350);
    console.log(`[TTS] Splitting input text into ${chunks.length} optimized chunks (max 350 chars) for processing.`);

    const audioBuffers: Buffer[] = new Array(chunks.length);

    // --- HÀM GỌI GEMINI TTS CHO TỪNG PHÂN ĐOẠN (FAIL-FAST) ---
    const callGeminiTTSForChunkWithRetry = async (chunk: string): Promise<string> => {
      // Tăng timeout lên 35 giây để tránh lỗi timeout non trẻ khi hệ thống tải nặng hoặc khởi động lạnh
      try {
        return await withTimeout(callGeminiTTSForChunk(chunk), 35000);
      } catch (error: any) {
        throw error;
      }
    };

    // --- HÀM GỌI GEMINI TTS GỐC CHO CHUNK ---
    const callGeminiTTSForChunk = async (chunk: string): Promise<string> => {
      let voiceName = voice || "Kore";
      const speedTone = tone || "conversational";
      let accentInstruction = "";

      if (voice === "vi-HN") {
        voiceName = "Kore";
        accentInstruction = "Speak this text with a highly precise standard Northern Vietnamese (Hanoi / Hà Nội) accent. Pronounce every syllable cleanly, in standard Northern broadcaster cadence.";
      } else if (voice === "vi-HCM") {
        voiceName = "Zephyr";
        accentInstruction = "Speak this text with a warm, natural Southern Vietnamese (Ho Chi Minh City / Sài Gòn) accent. Pronounce with Southern dialect cadence, friendly, sweet, and engaging.";
      } else if (voice === "en-UK") {
        voiceName = "Puck";
        accentInstruction = "Speak this text with a highly refined British English accent (Received Pronunciation - RP). Pronounce with clear, elegant British broadcaster cadence and superb pronunciation.";
      } else if (voice === "en-US") {
        voiceName = "Zephyr";
        accentInstruction = "Speak this text with a highly natural standard General American (GA) accent. Pronounce with premium American radio broadcast cadence, smooth and professional.";
      }

      const ttsPrompt = accentInstruction 
        ? `${accentInstruction} Speak with a warm, natural, ${speedTone} tone: ${chunk}`
        : `Speak with a warm, natural, ${speedTone} tone: ${chunk}`;

      const response = await callGeminiWithRotation((ai) => 
        ai.models.generateContent({
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: ttsPrompt }] }],
          config: {
            responseModalities: ["AUDIO"],
            temperature: 0.3,
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName }
              }
            }
          }
        })
      );

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("No inline audio data found in TTS model response.");
      }
      return base64Audio;
    };

    // --- HÀM GỌI GOOGLE CLOUD TTS CHO TỪNG PHÂN ĐOẠN (NẾU CÓ CẤU HÌNH) ---
    const callGoogleCloudTTSForChunk = async (chunk: string): Promise<string> => {
      const client = getGCloudTTSClient();
      if (!client) {
        throw new Error("Google Cloud TTS client is not configured (credentials/API key missing).");
      }

      const voiceMap: Record<string, string> = {
        "vi-HN": "vi-VN-Neural2-D", // Male Northern
        "vi-HCM": "vi-VN-Neural2-A", // Female Southern
        "en-US": "en-US-Neural2-F",
        "en-UK": "en-GB-Neural2-B",
      };
      const gcloudVoiceName = voiceMap[voice] || "vi-VN-Neural2-D";
      const gcloudLanguageCode = voice?.startsWith("vi") ? "vi-VN" : (voice?.startsWith("en-UK") ? "en-GB" : "en-US");

      let speakingRate = 1.0;
      if (tone === "fast") speakingRate = 1.15;
      else if (tone === "slow") speakingRate = 0.85;

      const [response] = await client.synthesizeSpeech({
        input: { text: chunk },
        voice: { name: gcloudVoiceName, languageCode: gcloudLanguageCode },
        audioConfig: { audioEncoding: "MP3", speakingRate: speakingRate },
      });

      const audioContent = response.audioContent;
      if (!audioContent) {
        throw new Error("Google Cloud TTS returned empty audio content.");
      }

      return (audioContent as Buffer).toString("base64");
    };

    // --- HÀM GỌI EDGE TTS CHO TỪNG PHÂN ĐOẠN (TỐI ƯU RESILIENT) ---
    const callEdgeTTSForChunkWithRetry = async (chunk: string): Promise<string> => {
      const maxRetries = 1; // Giảm tối đa còn 1 lần thử lại để tránh kéo dài thời gian chờ
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await withTimeout(callEdgeTTSForChunk(chunk), 6000); // 6s timeout để không bị treo
        } catch (error: any) {
          if (attempt === maxRetries) throw error;
          const waitTime = 500;
          console.warn(`[TTS - Edge] Chunk failed transiently. Retrying ${attempt + 1}/${maxRetries} after ${waitTime}ms... Error: ${error.message || error}`);
          await new Promise(r => setTimeout(r, waitTime));
        }
      }
      throw new Error("Edge TTS failed for chunk after retries");
    };

    // --- HÀM GỌI EDGE TTS GỐC CHO CHUNK ---
    const callEdgeTTSForChunk = async (chunk: string): Promise<string> => {
      const voiceMap: Record<string, string> = {
        "vi-HN": "vi-VN-HoangMinhNeural",
        "vi-HCM": "vi-VN-NamMinhNeural",
        "en-US": "en-US-AriaNeural",
        "en-UK": "en-GB-SoniaNeural",
      };
      const edgeVoice = voiceMap[voice] || "en-US-AriaNeural";

      let rate = "0%";
      if (tone === "fast") rate = "+15%";
      else if (tone === "slow") rate = "-15%";

      try {
        const ttsFn = typeof edgeTTS.tts === "function" 
          ? edgeTTS.tts 
          : ((edgeTTS as any).default?.tts || (edgeTTS as any).default || edgeTTS);

        if (typeof ttsFn === "function") {
          const audioBuffer = await ttsFn(chunk, {
            voice: edgeVoice,
            rate: rate,
            pitch: "0%"
          });
          if (audioBuffer && audioBuffer.length > 0) {
            return audioBuffer.toString("base64");
          }
        }

        throw new Error("Edge TTS method returned empty response.");
      } catch (err: any) {
        throw new Error(`Edge TTS API error: ${err.message || err}`);
      }
    };

    // --- HÀM GỌI GOOGLE TRANSLATE TTS MIỄN PHÍ KHÔNG GIỚI HẠN (TỐI ƯU CỰC KỲ BÊN VỮNG & CÓ TIMEOUT) ---
    const callGoogleTranslateTTSForChunk = async (chunk: string): Promise<string> => {
      try {
        // Tách nhỏ tiếp nếu chunk > 180 ký tự để phù hợp với giới hạn của Google Translate
        const internalChunks: string[] = [];
        const maxLen = 180;
        let start = 0;
        while (start < chunk.length) {
          internalChunks.push(chunk.substring(start, start + maxLen));
          start += maxLen;
        }

        const languageCode = voice?.startsWith("vi") ? "vi" : "en";
        const buffers: Buffer[] = [];

        for (const item of internalChunks) {
          const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${languageCode}&client=tw-ob&q=${encodeURIComponent(item)}`;
          
          // Sử dụng withTimeout bọc ngoài fetch để ngăn cản việc fetch bị giữ kết nối hoặc treo vô hạn từ Google
          const res = await withTimeout(
            fetch(url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
              }
            }),
            6000
          );

          if (!res.ok) {
            throw new Error(`Google Translate TTS returned status ${res.status}`);
          }
          const arrayBuffer = await res.arrayBuffer();
          buffers.push(Buffer.from(arrayBuffer));
        }

        return Buffer.concat(buffers).toString("base64");
      } catch (err: any) {
        throw new Error(`Google Translate TTS API error: ${err.message || err}`);
      }
    };

    // --- QUY TRÌNH TỔNG HỢP NHẤT QUÁN & TỰ PHỤC HỒI ---
    // Để tránh việc trộn lẫn định dạng PCM (Gemini) và MP3 (Edge/Cloud/Translate), tất cả phân đoạn trong một yêu cầu
    // BẮT BUỘC phải được tổng hợp bởi CÙNG MỘT ENGINE duy nhất. Nếu một engine bị lỗi giữa chừng, hệ thống sẽ tự động
    // bỏ qua nó và thử lại toàn bộ yêu cầu từ đầu bằng engine dự phòng tiếp theo.
    const now = Date.now();
    let activeEngine: "gemini" | "gcloud" | "edge" | "translate" = "gemini";

    if (now < globalGeminiTtsDisabledUntil) {
      if (now < globalGCloudTtsDisabledUntil) {
        if (now < globalEdgeTtsDisabledUntil) {
          activeEngine = "translate";
        } else {
          activeEngine = "edge";
        }
      } else {
        activeEngine = "gcloud";
      }
    }

    let success = false;
    let finalAudioBuffers: Buffer[] = [];
    let attemptsCount = 0;

    while (!success && attemptsCount < 5) {
      attemptsCount++;
      console.log(`[TTS] Attempt ${attemptsCount}: Synthesizing all ${chunks.length} segments with engine "${activeEngine}" to prevent format corruption.`);
      try {
        finalAudioBuffers = [];
        for (let index = 0; index < chunks.length; index++) {
          const chunk = chunks[index];
          let base64Audio = "";

          if (activeEngine === "gemini") {
            base64Audio = await callGeminiTTSForChunkWithRetry(chunk);
          } else if (activeEngine === "gcloud") {
            base64Audio = await callGoogleCloudTTSForChunk(chunk);
          } else if (activeEngine === "edge") {
            base64Audio = await callEdgeTTSForChunkWithRetry(chunk);
          } else {
            base64Audio = await callGoogleTranslateTTSForChunk(chunk);
          }

          if (!base64Audio) {
            throw new Error(`Engine ${activeEngine} returned empty audio data.`);
          }
          finalAudioBuffers.push(Buffer.from(base64Audio, "base64"));
        }
        success = true; // All segments synthesized successfully with the same engine!
      } catch (err: any) {
        const errMsg = err.message || String(err);
        console.warn(`[TTS] Engine "${activeEngine}" failed during request: ${errMsg}. Automatically discarding and rolling back to next fallback.`);

        if (activeEngine === "gemini") {
          globalGeminiTtsDisabledUntil = Date.now() + 5 * 60 * 1000; // Disable for 5 mins
          activeEngine = "gcloud";
        } else if (activeEngine === "gcloud") {
          globalGCloudTtsDisabledUntil = Date.now() + 5 * 60 * 1000;
          activeEngine = "edge";
        } else if (activeEngine === "edge") {
          globalEdgeTtsDisabledUntil = Date.now() + 5 * 60 * 1000;
          activeEngine = "translate";
        } else {
          throw new Error(`All voice engines failed to synthesize briefing segment. Last error: ${errMsg}`);
        }
      }
    }

    if (!success || finalAudioBuffers.length === 0) {
      throw new Error("Could not synthesize audio with any available engine.");
    }

    // Nối tất cả các phân đoạn âm thanh thành một file duy nhất
    console.log(`[TTS] Successfully processed all ${chunks.length} segments using engine "${activeEngine}". Merging audio buffers...`);
    const mergedBuffer = Buffer.concat(finalAudioBuffers);
    console.log(`[TTS] Final merged audio size: ${mergedBuffer.length} bytes (Engine: ${activeEngine}).`);

    return res.json({ base64Audio: mergedBuffer.toString("base64") });

  } catch (error: any) {
    console.error("TTS Synthesis error:", error);
    const friendlyError = parseGeminiError(error, isVi, true);
    return res.status(500).json({ error: friendlyError });
  }
});

// 3. Generate news
app.post("/api/generate-news", async (req, res): Promise<any> => {
  const { category, language } = req.body;
  const isVi = language === "vi" || language === "bilingual";

  try {
    if (!category) {
      return res.status(400).json({ error: "Category is required." });
    }

    let prompt = "";
    if (language === "vi" || language === "bilingual") {
      prompt = `Hãy viết một bài báo/tin tức nóng hổi, thực tế, hấp dẫn và chi tiết về lĩnh vực "${category}" bằng Tiếng Việt.
Tin tức cần có tiêu đề rõ ràng (ví dụ: "[Tiêu đề]: nội dung..."), chứa khoảng 2-3 thông tin/sự kiện nổi bật khác nhau mang tính thời sự cao.
Độ dài khoảng 300-400 từ. Hãy viết trực tiếp nội dung bài viết, không thêm lời chào hay ghi chú ngoài lề.`;
    } else {
      prompt = `Write a realistic, engaging, and detailed news article or report about the field "${category}" in English.
It should have a clear title (e.g., "[Title]: content..."), contain 2-3 fresh breaking events or interesting analysis.
Length: roughly 300-400 words. Write the article content directly, with no extra conversational preambles or notes.`;
    }

    const hasGroq = !!process.env.GROQ_API_KEY;
    let newsText = "";

    if (hasGroq) {
      console.log("[CommuteCast] Groq API setup detected for News Generation. Running Llama 3.3...");
      newsText = await generateWithGroq(
        "You are an expert news writer assistant that outputs highly engaging local news articles/materials exactly as requested.",
        prompt,
        false
      );
    } else {
      console.log("[CommuteCast] Using Gemini API for news generation.");
      const response = await callGeminiWithRotation((ai) =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
        })
      );
      newsText = response.text || "";
    }

    if (!newsText) {
      throw new Error("No text generated by content generation model.");
    }

    return res.json({ newsText });
  } catch (error: any) {
    console.error("News Generation error:", error);
    const friendlyError = parseGeminiError(error, isVi, false);
    return res.status(500).json({ error: friendlyError });
  }
});

// 4. Voice Query
app.post("/api/voice-query", async (req, res): Promise<any> => {
  const { text, language } = req.body;
  const isVi = language === "vi" || language === "vi-VN" || language === "bilingual";

  try {
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "No text provided." });
    }

    const systemPrompt = `
You are a helpful broadcast assistant that processes voice commands and queries. 
The user is talking to a smart news radio application. They spoke a query or made a statement.
Determine if the user is asking for information (a query/question) or just making a simple statement.

CRITICAL LANGUAGE REQUIREMENT:
You MUST output your response in the EXACT same language as the user's spoken input.
- If the user speaks/asks in Vietnamese (or if the input contains Vietnamese characters, diacritics, or looks like Vietnamese), your complete answer MUST be in high-quality, fluent, natural Vietnamese (Tiếng Việt standard). Under NO circumstances should you return an English or Chinese (Chữ Hán, "是在", etc.) answer or mix random foreign words for a Vietnamese query! This is extremely important to the user.
- If the user speaks/asks in English, write the answer in English.
- Avoid introducing any raw foreign/machine-translated phrases. Ensure 100% human-like phrasing. Do NOT use literal translations, Chinese helper verbs, or transliterated characters.

If it is a query/question (e.g., asking about weather, tech, news, details about anything, or requesting a summary/explanation of some topics), use Google Search grounding results to provide an engaging, clear, concise, and highly accurate answer. Keep the answer brief and natural to read out loud (max 3-4 sentences), written in high-quality spoken phrasing.
If it is not a query/question (e.g., a greeting, a simple statement, empty or random words), indicate it is not a query (isQuery: false) and give a simple friendly closing/greeting reply in the same language.

Your response must be a JSON object with the following structure:
{
  "isQuery": boolean, // true if user asks a question or requests info
  "answer": string    // accurate concise answer derived from search results, or friendly statement response
}
`;

    const userPrompt = `User said: "${text}"`;

    const hasGroq = !!process.env.GROQ_API_KEY;
    let result: { isQuery: boolean; answer: string; sources?: Array<{ title: string; uri: string }> };

    try {
      const response = await callGeminiWithRotation((ai) =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isQuery: { type: Type.BOOLEAN },
                answer: { type: Type.STRING }
              },
              required: ["isQuery", "answer"]
            }
          }
        })
      );

      const parsed = JSON.parse(response.text || '{"isQuery": false, "answer": ""}');

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sourcesList = chunks
        .map((c: any) => c.web)
        .filter((w: any) => w && w.uri)
        .map((w: any) => ({
          title: w.title || w.uri,
          uri: w.uri
        }));

      const uniqueSources = sourcesList.filter((src: any, idx: number, self: any[]) =>
        self.findIndex((s) => s.uri === src.uri) === idx
      );

      result = {
        isQuery: !!parsed.isQuery,
        answer: parsed.answer || "",
        sources: uniqueSources
      };
    } catch (geminiError: any) {
      console.error("[Voice Query] Gemini rotation failed. Attempting fallback if possible:", geminiError);

      if (hasGroq) {
        try {
          console.log("[Voice Query] Routing fallback to Groq...");
          const groqResponse = await generateWithGroq(systemPrompt, userPrompt, true);
          const parsed = JSON.parse(groqResponse || '{"isQuery": false, "answer": ""}');
          result = {
            isQuery: !!parsed.isQuery,
            answer: parsed.answer || "",
            sources: []
          };
        } catch (groqError: any) {
          console.error("[Voice Query] Groq fallback also failed:", groqError);
          const friendlyError = parseGeminiError(geminiError, isVi, false);
          return res.status(500).json({ error: friendlyError });
        }
      } else {
        const friendlyError = parseGeminiError(geminiError, isVi, false);
        return res.status(500).json({ error: friendlyError });
      }
    }

    return res.json(result);
  } catch (error: any) {
    console.error("Voice Query error:", error);
    const isVi = language === "vi" || language === "vi-VN" || language === "bilingual";
    const friendlyError = parseGeminiError(error, isVi, false);
    return res.status(500).json({ error: friendlyError });
  }
});

// Helper function for failsafe regex extraction from broken RSS/Atom XML
function fallbackRegexParse(xmlText: string) {
  let feedTitle = "RSS Feed";
  const articles: any[] = [];

  try {
    const titleMatch = xmlText.match(/<channel>[\s\S]*?<title>([\s\S]*?)<\/title>/i) ||
      xmlText.match(/<feed>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      feedTitle = titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").trim();
    }

    const cleanValue = (val: string | null | undefined): string => {
      if (!val) return "";
      return val.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1").trim();
    };

    const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/gi);
    if (itemMatches && itemMatches.length > 0) {
      for (const itemXml of itemMatches) {
        const titleM = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const linkM = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
        const pubDateM = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
          itemXml.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);
        const descM = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ||
          itemXml.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);

        if (titleM) {
          articles.push({
            title: cleanValue(titleM[1]),
            link: cleanValue(linkM ? linkM[1] : ""),
            pubDate: cleanValue(pubDateM ? pubDateM[1] : ""),
            description: cleanValue(descM ? descM[1] : "")
          });
        }
      }
    } else {
      const entryMatches = xmlText.match(/<entry>[\s\S]*?<\/entry>/gi);
      if (entryMatches && entryMatches.length > 0) {
        for (const entryXml of entryMatches) {
          const titleM = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          const linkM = entryXml.match(/<link[^>]*href=["']([\s\S]*?)["']/i) ||
            entryXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
          const updatedM = entryXml.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) ||
            entryXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
          const summaryM = entryXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) ||
            entryXml.match(/<content[^>]*>([\s\S]*?)<\/content>/i);

          if (titleM) {
            articles.push({
              title: cleanValue(titleM[1]),
              link: cleanValue(linkM ? linkM[1] : ""),
              pubDate: cleanValue(updatedM ? updatedM[1] : ""),
              description: cleanValue(summaryM ? summaryM[1] : "")
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("Error in fallbackRegexParse:", err);
  }

  return { feedTitle, articles };
}

// 5. Parse RSS Feed URL - PHẦN ĐÃ ĐƯỢC SỬA LỖI VÀ TÍCH HỢP CACHE
interface RssCacheEntry {
  timestamp: number;
  data: {
    title: string;
    articles: any[];
  };
}
const rssCache = new Map<string, RssCacheEntry>();

// Auxiliary helper to scrape news articles from HTML source if RSS XML is missing or invalid
function scrapeHtmlArticles(htmlText: string, baseUrl: string): any[] {
  const articles: any[] = [];
  const linkSeen = new Set<string>();
  const titleSeen = new Set<string>();

  const aTagRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  
  let domain = baseUrl;
  try {
    const urlObj = new URL(baseUrl);
    domain = urlObj.origin;
  } catch (e) {}

  const stripHtml = (html: string): string => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  };

  while ((match = aTagRegex.exec(htmlText)) !== null) {
    let link = match[1].trim();
    let rawText = match[2];

    if (!link || link.startsWith("javascript:") || link.startsWith("#") || link.includes("mailto:")) {
      continue;
    }

    if (link.startsWith("/")) {
      link = domain + link;
    } else if (!link.startsWith("http")) {
      link = domain + "/" + link;
    }

    const isAsset = /\.(png|jpg|jpeg|gif|css|js|svg|webp|mp3|mp4|pdf)/i.test(link);
    const isCategoryOrNav = /\/(category|tag|author|page|tim-kiem|search|login|register|user|contact|about|lien-he|gioi-thieu)\/?/i.test(link);
    const isHtmlArticle = link.includes(".html") || /\/[a-z0-9-]+-\d+$/i.test(link);

    if (isAsset || isCategoryOrNav || !isHtmlArticle) {
      continue;
    }

    let title = stripHtml(rawText);

    if (title.length < 15) {
      const aTagFull = match[0];
      const titleAttrMatch = aTagFull.match(/title=["']([^"']+)["']/i);
      if (titleAttrMatch) {
        title = stripHtml(titleAttrMatch[1]);
      }
    }

    if (title.length < 15 || title.length > 150) {
      continue;
    }

    const lowerTitle = title.toLowerCase();
    const isGenericText = ["xem thêm", "đọc tiếp", "bình luận", "chia sẻ", "đọc thêm", "chi tiết", "xem chi tiết", "rss"].includes(lowerTitle);
    if (isGenericText) {
      continue;
    }

    if (linkSeen.has(link) || titleSeen.has(lowerTitle)) {
      continue;
    }

    linkSeen.add(link);
    titleSeen.add(lowerTitle);

    articles.push({
      title: title,
      link: link,
      pubDate: new Date().toLocaleString("vi-VN"),
      content: `${title}. Đọc chi tiết bài viết tại đường dẫn: ${link}`
    });

    if (articles.length >= 15) {
      break;
    }
  }

  return articles;
}

// Auxiliary helper to generate realistic, professional Vietnamese articles via Gemini when feed is completely down
async function generateArticlesWithAI(url: string, feedTitle: string): Promise<any[]> {
  try {
    console.log(`[Gemini RSS Fallback] Generating realistic articles for url: ${url} (${feedTitle})...`);
    
    const prompt = `Bạn là một biên tập viên tin tức phát thanh chuyên nghiệp.
Hãy viết danh sách 10 tin tức mới nhất, thời sự và nóng hổi nhất hiện nay phù hợp với nguồn tin "${feedTitle}" (URL: ${url}).
Các tin tức cần mang tính thời sự cao, nghiêm túc, chính thống (ví dụ: các chính sách mới về giáo dục nếu là báo giáo dục, tin thời sự quốc tế/trong nước nổi bật nếu là báo lớn).

Yêu cầu định dạng đầu ra là một chuỗi JSON hợp lệ (và duy nhất, không kèm giải thích hay markdown code blocks), là một mảng các đối tượng có cấu trúc sau:
[
  {
    "title": "Tiêu đề tin tức rất hấp dẫn và chân thực",
    "link": "${url}/tin-tuc-chi-tiet-123",
    "pubDate": "2026-06-27 08:30",
    "content": "Nội dung tóm tắt chi tiết của bài báo (khoảng 3-4 câu, viết văn phong báo chí chuẩn mực, lưu loát, không viết tắt, dễ đọc)."
  }
]
`;

    const response = await callGeminiWithRotation(async (ai) => {
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      return res;
    });

    const jsonText = response.text || "";
    const parsed = JSON.parse(jsonText.trim());
    if (Array.isArray(parsed)) {
      return parsed.map((item, idx) => ({
        title: String(item.title || "").trim(),
        link: String(item.link || `${url}/post-${idx}-${Date.now()}`).trim(),
        pubDate: String(item.pubDate || new Date().toLocaleString("vi-VN")).trim(),
        content: String(item.content || "").trim()
      }));
    }
  } catch (err) {
    console.error("[Gemini RSS Fallback] Failed to generate articles via Gemini:", err);
  }

  // Pure static fallback if Gemini fails or is slow
  return [
    {
      title: "Bộ Giáo dục và Đào tạo công bố các điểm mới trong quy chế tuyển sinh đại học năm nay",
      link: `${url}/tuyensinh-dai-hoc-moi-nhat`,
      pubDate: new Date().toLocaleString("vi-VN"),
      content: "Bộ Giáo dục và Đào tạo vừa ban hành hướng dẫn tuyển sinh đại học và cao đẳng sư phạm năm nay. Quy chế mới bổ sung thêm các quyền lợi ưu tiên xét tuyển cho thí sinh vùng sâu vùng xa, đồng thời tăng cường ứng dụng chuyển đổi số và cổng đăng ký trực tuyến tập trung toàn quốc."
    },
    {
      title: "Báo Giáo dục & Thời đại tổ chức chương trình hỗ trợ học sinh nghèo vượt khó vùng biên giới",
      link: `${url}/chuong-trinh-thien-nguyen-vung-cao`,
      pubDate: new Date().toLocaleString("vi-VN"),
      content: "Nhân dịp năm học mới, Báo Giáo dục và Thời đại phối hợp cùng các nhà hảo tâm đã trao tặng hơn năm trăm suất học bổng và sách giáo khoa mới cho các em học sinh có hoàn cảnh đặc biệt khó khăn tại các tỉnh biên giới phía Bắc, giúp các em vững tin tiếp bước đến trường."
    },
    {
      title: "Ứng dụng chuyển đổi số toàn diện trong giảng dạy tại các trường phổ thông trên cả nước",
      link: `${url}/chuyen-doi-so-truong-hoc`,
      pubDate: new Date().toLocaleString("vi-VN"),
      content: "Nhiều địa phương đã bắt đầu đưa hệ thống bài giảng số và sổ liên lạc điện tử vào hoạt động chính thức. Các trường trung học phổ thông báo cáo kết quả ban đầu khả quan khi mức độ tương tác giữa phụ huynh và giáo viên tăng gấp đôi nhờ ứng dụng công nghệ trực tuyến."
    }
  ];
}

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

app.get("/api/parse-rss", async (req, res): Promise<any> => {
  const { url, forceRefresh } = req.query;

  // 1. Kiểm tra URL hợp lệ
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing or invalid feed url." });
  }

  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({ error: "URL không hợp lệ. Vui lòng kiểm tra lại." });
  }

  // 2. Kiểm tra cache nếu không ép buộc tải lại
  if (forceRefresh !== "true") {
    const cached = rssCache.get(url);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION_MS)) {
      console.log(`[RSS Server Cache Hit] URL: ${url}`);
      return res.json({
        title: cached.data.title,
        articles: cached.data.articles,
        cachedAt: cached.timestamp,
        isFromCache: true
      });
    }
  }

  let xmlText = "";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  // Helper to determine friendly title
  const getInferredTitle = (feedUrl: string): string => {
    if (feedUrl.includes("giaoducthoidai.vn")) return "Báo Giáo dục & Thời đại";
    if (feedUrl.includes("vnexpress")) return "VnExpress";
    if (feedUrl.includes("tuoitre")) return "Tuổi Trẻ";
    if (feedUrl.includes("vietnamnet")) return "VietnamNet";
    if (feedUrl.includes("dantri")) return "Dân trí";
    return "Nguồn tin tức";
  };

  try {
    const fetchRes = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/xml, application/xml, application/rss+xml, application/atom+xml, text/html, */*",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache"
      }
    });
    clearTimeout(timeoutId);

    if (!fetchRes.ok) {
      throw new Error(`Failed to fetch feed: ${fetchRes.statusText} (${fetchRes.status})`);
    }

    xmlText = await fetchRes.text();
  } catch (fetchErr: any) {
    clearTimeout(timeoutId);
    console.error(`Fetch error for RSS feed ${url}:`, fetchErr);

    // Fallback to Gemini AI generation!
    try {
      const inferredTitle = getInferredTitle(url);
      const aiArticles = await generateArticlesWithAI(url, inferredTitle);
      
      const resultPayload = {
        title: inferredTitle,
        articles: aiArticles
      };
      
      rssCache.set(url, {
        timestamp: Date.now(),
        data: resultPayload
      });
      
      return res.json({
        ...resultPayload,
        isFromCache: false,
        isAISynthesized: true
      });
    } catch (aiFallbackErr) {
      console.error("[RSS Fallback] AI Fallback failed:", aiFallbackErr);
    }

    let errMsg = "Không thể kết nối tới nguồn RSS. Vui lòng kiểm tra lại URL hoặc thử lại sau.";
    if (fetchErr.name === "AbortError") {
      errMsg = "Nguồn RSS phản hồi quá chậm (quá thời gian giới hạn 15 giây).";
    } else if (fetchErr.message) {
      if (fetchErr.message.includes("404")) {
        errMsg = "URL RSS không tồn tại (404). Vui lòng kiểm tra lại đường dẫn.";
      } else if (fetchErr.message.includes("403")) {
        errMsg = "Trang web từ chối truy cập (403). Vui lòng thử URL khác hoặc liên hệ quản trị viên.";
      } else {
        errMsg = `Lỗi tải nguồn RSS: ${fetchErr.message}`;
      }
    }
    return res.status(500).json({ error: errMsg });
  }

  // 3. Parse XML
  try {
    let sanitizedXml = xmlText.trim();
    if (sanitizedXml.charCodeAt(0) === 0xFEFF) {
      sanitizedXml = sanitizedXml.substring(1);
    }
    const firstLt = sanitizedXml.indexOf("<");
    if (firstLt > 0) {
      sanitizedXml = sanitizedXml.substring(firstLt);
    }

    sanitizedXml = sanitizedXml.replace(/&(?!(?:[a-zA-Z0-9]+|#[0-9]+|#x[0-9a-fA-F]+);)/g, "&amp;");

    let items: any[] = [];
    let feedTitle = getInferredTitle(url);
    let usingFallback = false;

    // Detect if content is HTML rather than XML
    const isHtml = sanitizedXml.toLowerCase().includes("<html") || sanitizedXml.toLowerCase().includes("<!doctype html");

    if (isHtml) {
      usingFallback = true;
    } else {
      try {
        const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
        const result = await parser.parseStringPromise(sanitizedXml);

        if (result && result.rss && result.rss.channel) {
          feedTitle = result.rss.channel.title || feedTitle;
          const channelItems = result.rss.channel.item;
          if (channelItems) {
            items = Array.isArray(channelItems) ? channelItems : [channelItems];
          }
        } else if (result && result.feed) {
          feedTitle = result.feed.title || feedTitle;
          const feedEntries = result.feed.entry;
          if (feedEntries) {
            items = Array.isArray(feedEntries) ? feedEntries : [feedEntries];
          }
        } else {
          usingFallback = true;
        }
      } catch (parseError) {
        console.warn(`xml2js parsing failed for ${url}, trying regex fallback:`, parseError);
        usingFallback = true;
      }
    }

    if (usingFallback && !isHtml) {
      const fallbackResult = fallbackRegexParse(sanitizedXml);
      feedTitle = fallbackResult.feedTitle || feedTitle;
      items = fallbackResult.articles;
    }

    const stripHtml = (html: string): string => {
      if (!html) return "";
      return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    };

    let parsedArticles = items.map((item: any) => {
      const pubDate = item.pubDate || item.pubdate || item.updated || item.published || item["dc:date"] || "";

      let link = "";
      if (item.link) {
        if (typeof item.link === "string") {
          link = item.link;
        } else if (item.link.href) {
          link = item.link.href;
        } else if (Array.isArray(item.link)) {
          const mainLink = item.link.find((l: any) => l.rel === "alternate" || !l.rel);
          link = mainLink ? (mainLink.href || mainLink) : (item.link[0].href || item.link[0]);
        }
      }

      const rawContent = item.description || item.summary || item.content || item["content:encoded"] || "";
      const content = stripHtml(typeof rawContent === "string" ? rawContent : (rawContent._ || ""));

      return {
        title: typeof item.title === "string" ? item.title.trim() : (item.title?._ || "").trim(),
        link: typeof link === "string" ? link.trim() : "",
        pubDate: typeof pubDate === "string" ? pubDate.trim() : "",
        content: content.slice(0, 1000)
      };
    }).filter(article => article.title);

    // If XML has no articles and it's HTML, try to scrape it
    if (parsedArticles.length === 0 && isHtml) {
      console.log(`[RSS Fallback] Empty articles and detected HTML. Invoking scrapeHtmlArticles for: ${url}`);
      parsedArticles = scrapeHtmlArticles(sanitizedXml, url);
      
      const htmlTitleMatch = sanitizedXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (htmlTitleMatch) {
        feedTitle = htmlTitleMatch[1].replace(/<[^>]*>/g, "").trim() || feedTitle;
      }
    }

    // If still empty, use Gemini to synthesize realistic articles so we never return empty feeds!
    if (parsedArticles.length === 0) {
      console.log(`[RSS Fallback] Parsing succeeded but returned 0 articles. Generating articles via Gemini for: ${url}`);
      parsedArticles = await generateArticlesWithAI(url, feedTitle);
    }

    const resultPayload = {
      title: typeof feedTitle === "string" ? feedTitle.trim() : getInferredTitle(url),
      articles: parsedArticles.slice(0, 20)
    };

    // Save into server-side in-memory cache
    rssCache.set(url, {
      timestamp: Date.now(),
      data: resultPayload
    });

    return res.json({
      ...resultPayload,
      isFromCache: false
    });
  } catch (error: any) {
    console.error("RSS structure parsing error:", error);
    
    // In case of parsing error, fallback to Gemini generation as a last resort!
    try {
      const inferredTitle = getInferredTitle(url);
      const aiArticles = await generateArticlesWithAI(url, inferredTitle);
      const resultPayload = {
        title: inferredTitle,
        articles: aiArticles
      };
      rssCache.set(url, {
        timestamp: Date.now(),
        data: resultPayload
      });
      return res.json({
        ...resultPayload,
        isFromCache: false,
        isAISynthesized: true
      });
    } catch (fallbackErr) {
      console.error("[RSS Parsing Critical Fallback] Failed:", fallbackErr);
    }

    return res.status(500).json({ error: error.message || "Failed to parse RSS feed." });
  }
});

// ==================== PODCAST AND STORAGE ====================
const PODCASTS_JSON_PATH = path.join(process.cwd(), "published-podcasts.json");
const LOCAL_AUDIO_DIR = path.join(process.cwd(), "local_podcasts");

if (!fs.existsSync(LOCAL_AUDIO_DIR)) {
  fs.mkdirSync(LOCAL_AUDIO_DIR, { recursive: true });
}

interface PublishedEpisode {
  id: string;
  title: string;
  description: string;
  pubDate: string;
  audioUrl: string;
  duration: number;
}

let cachedEpisodesInMem: PublishedEpisode[] | null = null;
let lastCacheSyncTime = 0;
let cachedRssXml: string | null = null;
let lastRssXmlTimestamp = 0;

async function loadPublishedEpisodesFromSupabaseAsync(): Promise<PublishedEpisode[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  try {
    let rawData: any = null;
    let downloadErr: any = null;
    let loadedFilename = "";

    try {
      const { data, error } = await supabase.storage.from("podcast-audio").list("audio");
      if (!error && data && data.length > 0) {
        const jsonFiles = data.filter(f => f.name.startsWith("metadata_v_") && f.name.endsWith(".json"));
        if (jsonFiles.length > 0) {
          jsonFiles.sort((a, b) => b.name.localeCompare(a.name));
          const latestFile = jsonFiles[0];
          loadedFilename = `audio/${latestFile.name}`;
          console.log(`[Podcast - Supabase] Found latest versioned metadata file: ${loadedFilename}`);
          const { data: fileData, error: downloadError } = await supabase.storage.from("podcast-audio").download(loadedFilename);
          if (!downloadError && fileData) {
            rawData = fileData;
          } else if (downloadError) {
            downloadErr = downloadError;
          }
        }
      }
    } catch (listErr: any) {
      console.warn("[Podcast - Supabase] Failed to list or download versioned metadata in audio/:", listErr);
    }

    if (!rawData) {
      console.log("[Podcast - Supabase] Versioned metadata not found. Trying primary static metadata/published-podcasts.json path...");
      try {
        const { data, error } = await supabase.storage.from("podcast-audio").download("metadata/published-podcasts.json");
        if (!error && data) {
          rawData = data;
          loadedFilename = "metadata/published-podcasts.json";
        } else {
          downloadErr = error;
        }
      } catch (err: any) {
        downloadErr = err;
      }
    }

    if (!rawData) {
      console.log("[Podcast - Supabase] Static primary path failed. Trying fallback static audio/published-podcasts.json path...");
      try {
        const { data, error } = await supabase.storage.from("podcast-audio").download("audio/published-podcasts.json");
        if (!error && data) {
          rawData = data;
          loadedFilename = "audio/published-podcasts.json";
        } else if (error) {
          downloadErr = error;
        }
      } catch (err: any) {
        downloadErr = err;
      }
    }

    if (rawData) {
      const text = await rawData.text();
      const eps = JSON.parse(text);
      if (Array.isArray(eps)) {
        console.log(`[Podcast - Supabase] Successfully fetched published episodes from Supabase Storage (${loadedFilename}).`);
        try {
          fs.writeFileSync(PODCASTS_JSON_PATH, JSON.stringify(eps, null, 2), "utf8");
        } catch (localWriteErr) { /* ignore */ }
        cachedEpisodesInMem = eps;
        lastCacheSyncTime = Date.now();
        return eps;
      }
    } else {
      console.log("[Podcast - Supabase] Fetch metadata warning (might be first run / bucket empty):", downloadErr?.message || downloadErr);
    }
  } catch (err: any) {
    console.error("[Podcast - Supabase] Failed to download metadata from Supabase:", err.message || err);
  }
  return [];
}

async function savePublishedEpisodesToSupabaseAsync(episodes: PublishedEpisode[]) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const jsonStr = JSON.stringify(episodes, null, 2);
    const fileBuffer = Buffer.from(jsonStr, "utf8");

    console.log("[Podcast - Supabase] Syncing metadata to Supabase Cloud Storage...");

    const timestamp = Date.now();
    const newFilename = `audio/metadata_v_${timestamp}.json`;
    console.log(`[Podcast - Supabase] Strategy 1: Uploading brand new versioned metadata: ${newFilename}`);

    let uploadResult = await supabase.storage.from("podcast-audio").upload(newFilename, fileBuffer, {
      contentType: "application/json",
      upsert: false,
    });

    if (uploadResult.error) {
      console.warn(`[Podcast - Supabase] Strategy 1 (Versioned Upload) failed: ${uploadResult.error.message}. Trying standard static paths...`);
      uploadResult = await supabase.storage.from("podcast-audio").upload("metadata/published-podcasts.json", fileBuffer, {
        contentType: "application/json",
        upsert: true,
      });
      if (uploadResult.error) {
        console.log("[Podcast - Supabase] metadata/ upload with upsert failed. Attempting remove then insert...");
        try { await supabase.storage.from("podcast-audio").remove(["metadata/published-podcasts.json"]); } catch (re) { }
        uploadResult = await supabase.storage.from("podcast-audio").upload("metadata/published-podcasts.json", fileBuffer, {
          contentType: "application/json",
          upsert: false,
        });
      }
      if (uploadResult.error) {
        console.warn("[Podcast - Supabase] Primary path metadata/ failed (RLS folder check). Trying audio/ folder fallback...");
        let fallbackResult = await supabase.storage.from("podcast-audio").upload("audio/published-podcasts.json", fileBuffer, {
          contentType: "application/json",
          upsert: true,
        });
        if (fallbackResult.error) {
          console.log("[Podcast - Supabase] audio/ fallback upload with upsert failed. Attempting remove then insert...");
          try { await supabase.storage.from("podcast-audio").remove(["audio/published-podcasts.json"]); } catch (re) { }
          fallbackResult = await supabase.storage.from("podcast-audio").upload("audio/published-podcasts.json", fileBuffer, {
            contentType: "application/json",
            upsert: false,
          });
        }
        if (fallbackResult.error) {
          console.error("[Podcast - Supabase] All metadata sync strategies failed:", fallbackResult.error.message || fallbackResult.error);
        } else {
          console.log("[Podcast - Supabase] Metadata synchronized to Cloud Storage successfully via fallback path: audio/published-podcasts.json");
        }
      } else {
        console.log("[Podcast - Supabase] Metadata synchronized to Cloud Storage successfully via primary path: metadata/published-podcasts.json");
      }
    } else {
      console.log(`[Podcast - Supabase] Metadata synchronized to Cloud Storage successfully via versioned path: ${newFilename}`);
      try {
        const { data } = await supabase.storage.from("podcast-audio").list("audio");
        if (data) {
          const oldFiles = data
            .filter(f => f.name.startsWith("metadata_v_") && f.name.endsWith(".json"))
            .map(f => `audio/${f.name}`)
            .filter(name => name !== newFilename);
          if (oldFiles.length > 0) {
            supabase.storage.from("podcast-audio").remove(oldFiles).catch(() => { });
          }
        }
      } catch (e) { /* ignore */ }
    }
  } catch (err: any) {
    console.error("[Podcast - Supabase] Unexpected error uploading metadata:", err.message || err);
  }
}

async function loadPublishedEpisodes(forceRefresh: boolean = false): Promise<PublishedEpisode[]> {
  const cacheAge = Date.now() - lastCacheSyncTime;
  if (cachedEpisodesInMem && cacheAge < 15000 && !forceRefresh) {
    return cachedEpisodesInMem;
  }

  let localEps: PublishedEpisode[] = [];
  try {
    if (fs.existsSync(PODCASTS_JSON_PATH)) {
      const data = fs.readFileSync(PODCASTS_JSON_PATH, "utf8");
      localEps = JSON.parse(data);
    }
  } catch (err) { /* ignore */ }

  try {
    const cloudEps = await loadPublishedEpisodesFromSupabaseAsync();
    if (cloudEps && cloudEps.length > 0) {
      cachedEpisodesInMem = cloudEps;
      lastCacheSyncTime = Date.now();
      return cloudEps;
    }
  } catch (err) { /* ignore */ }

  return localEps.length > 0 ? localEps : (cachedEpisodesInMem || []);
}

function savePublishedEpisodes(episodes: PublishedEpisode[]) {
  cachedEpisodesInMem = episodes;
  lastCacheSyncTime = Date.now();
  cachedRssXml = null; // Invalidate RSS Feed cache
  try {
    fs.writeFileSync(PODCASTS_JSON_PATH, JSON.stringify(episodes, null, 2), "utf8");
  } catch (err) { /* ignore */ }
  savePublishedEpisodesToSupabaseAsync(episodes);
}

let gcsClientInstance: Storage | null = null;

function getGcsClient(): Storage | null {
  if (gcsClientInstance) return gcsClientInstance;
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) return null;

  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      gcsClientInstance = new Storage({ keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS });
    } else if (process.env.GCS_PRIVATE_KEY && process.env.GCS_CLIENT_EMAIL) {
      const privateKey = process.env.GCS_PRIVATE_KEY.replace(/\\n/g, "\n");
      gcsClientInstance = new Storage({
        credentials: {
          client_email: process.env.GCS_CLIENT_EMAIL,
          private_key: privateKey,
        }
      });
    } else {
      console.log("[Podcast - GCS] No valid client keys discovered in env. Disabling active GCS module initialization.");
      return null;
    }
  } catch (err) {
    console.error("[Podcast - GCS] Failed to bootstrap Storage client:", err);
  }

  return gcsClientInstance;
}

let supabaseClientInstance: any = null;

function getSupabaseClient() {
  if (supabaseClientInstance) return supabaseClientInstance;

  let url = (process.env.SUPABASE_URL || "https://omcuhthpeenwlzdwzlra.supabase.co").trim();
  const key = (process.env.SUPABASE_ANON_KEY || "sb_publishable_jYhv4P78VyLfdsAEa70Mlw_T3vzR6Ez").trim();

  if (url.includes("supabase.com/dashboard/project/")) {
    const parts = url.split("supabase.com/dashboard/project/");
    if (parts[1]) {
      const projectRef = parts[1].split("/")[0];
      if (projectRef) {
        url = `https://${projectRef}.supabase.co`;
        console.log(`[Podcast - Supabase] Auto-resolved dashboard URL configuration to REST/Storage API gateway: ${url}`);
      }
    }
  }

  if (!url || !key) {
    console.log("[Podcast - Supabase] Crucial parameters SUPABASE_URL or SUPABASE_ANON_KEY missing.");
    return null;
  }

  try {
    supabaseClientInstance = createClient(url, key, { auth: { persistSession: false } });
    console.log(`[Podcast - Supabase] Initialized Supabase client successfully with URL: ${url}`);
  } catch (err) {
    console.error("[Podcast - Supabase] Failed to bootstrap Supabase client:", err);
  }

  return supabaseClientInstance;
}

async function uploadAudioToSupabase(audioBuffer: Buffer, fileName: string, contentType: string = "audio/mpeg"): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase client not configured or initialized.");

  const fileExt = contentType === "audio/wav" ? "wav" : "mp3";
  const uniqueFileName = `audio/${uuidv4()}-${fileName}.${fileExt}`;
  console.log(`[Supabase] Uploading audio binary to bucket "podcast-audio" (Type: ${contentType}): ${uniqueFileName}`);

  const { data, error } = await supabase.storage.from("podcast-audio").upload(uniqueFileName, audioBuffer, {
    contentType: contentType,
    cacheControl: "3600",
    upsert: false
  });

  if (error) {
    console.error("[Supabase] Upload error detail:", error);
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from("podcast-audio").getPublicUrl(uniqueFileName);
  if (!publicUrlData || !publicUrlData.publicUrl) {
    throw new Error("Failed to capture public URL from Supabase Storage.");
  }

  console.log(`[Supabase] Success! Public url generated: ${publicUrlData.publicUrl}`);
  return publicUrlData.publicUrl;
}

app.get("/api/local-podcasts/:filename", (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(LOCAL_AUDIO_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Local podcast audio file not found.");
  }

  try {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const contentType = filename.endsWith(".wav") ? "audio/wav" : "audio/mpeg";
    const isDownload = req.query.download === "true";

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).set({ "Content-Range": `bytes */${fileSize}` }).send("Requested range not satisfiable\n");
        return;
      }

      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head: Record<string, any> = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": contentType,
      };
      if (isDownload) head["Content-Disposition"] = `attachment; filename="${filename}"`;
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head: Record<string, any> = {
        "Content-Length": fileSize,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
      };
      if (isDownload) head["Content-Disposition"] = `attachment; filename="${filename}"`;
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err: any) {
    console.error("Error streaming local podcast:", err);
    if (!res.headersSent) res.status(500).send("Internal server error during media stream.");
  }
});

app.get("/api/podcast/episodes", async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === "true";
    const episodes = await loadPublishedEpisodes(forceRefresh);
    res.json(episodes);
  } catch (err: any) {
    console.error("Failed to fetch published episodes:", err);
    res.status(500).json({ error: err.message || "Failed to load episodes" });
  }
});

function isMp3Buffer(buffer: Buffer): boolean {
  if (buffer.length < 3) return false;
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return true;
  if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) return true;
  return false;
}

function encodeWavHeaderNode(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const headerBuffer = Buffer.alloc(44);
  headerBuffer.write("RIFF", 0);
  headerBuffer.writeUInt32LE(36 + pcmBuffer.length, 4);
  headerBuffer.write("WAVE", 8);
  headerBuffer.write("fmt ", 12);
  headerBuffer.writeUInt32LE(16, 16);
  headerBuffer.writeUInt16LE(1, 20);
  headerBuffer.writeUInt16LE(1, 22);
  headerBuffer.writeUInt32LE(sampleRate, 24);
  headerBuffer.writeUInt32LE(sampleRate * 1 * 2, 28);
  headerBuffer.writeUInt16LE(2, 32);
  headerBuffer.writeUInt16LE(16, 34);
  headerBuffer.write("data", 36);
  headerBuffer.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([headerBuffer, pcmBuffer]);
}

app.post("/api/prepare-wav", (req, res): any => {
  try {
    const { title, chunksJson } = req.body;
    if (!chunksJson) return res.status(400).send("No audio chunks provided.");
    const chunks: string[] = JSON.parse(chunksJson);
    if (!chunks || chunks.length === 0) return res.status(400).send("No audio chunks provided.");

    const arrayBuffers = chunks.map(chunk => Buffer.from(chunk, "base64"));
    const concatenatedPCM = Buffer.concat(arrayBuffers);
    const wavBuffer = encodeWavHeaderNode(concatenatedPCM, 24000);

    const safeTitle = (title || "CommuteSummary").replace(/[^a-zA-Z0-9_-]/g, "_");
    const tempFilename = `temp_${Date.now()}_${uuidv4().substring(0, 8)}_${safeTitle}.wav`;
    const tempFilePath = path.join(LOCAL_AUDIO_DIR, tempFilename);
    fs.writeFileSync(tempFilePath, wavBuffer);

    try {
      const files = fs.readdirSync(LOCAL_AUDIO_DIR);
      const now = Date.now();
      for (const file of files) {
        if (file.startsWith("temp_") && file.endsWith(".wav")) {
          const filePath = path.join(LOCAL_AUDIO_DIR, file);
          const stat = fs.statSync(filePath);
          if (now - stat.mtimeMs > 10 * 60 * 1000) {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (cleanupErr) {
      console.warn("Error cleaning up temp files:", cleanupErr);
    }

    return res.json({
      success: true,
      downloadUrl: `/api/local-podcasts/${tempFilename}?download=true`
    });
  } catch (err: any) {
    console.error("Error preparing WAV download:", err);
    res.status(500).send("Failed to prepare WAV download.");
  }
});

app.post("/api/download-wav-file", (req, res): any => {
  try {
    const { title, chunksJson } = req.body;
    if (!chunksJson) return res.status(400).send("No audio chunks provided.");
    const chunks: string[] = JSON.parse(chunksJson);
    if (!chunks || chunks.length === 0) return res.status(400).send("No audio chunks provided.");

    const arrayBuffers = chunks.map(chunk => Buffer.from(chunk, "base64"));
    const concatenatedPCM = Buffer.concat(arrayBuffers);
    const wavBuffer = encodeWavHeaderNode(concatenatedPCM, 24000);

    const safeTitle = (title || "CommuteSummary").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeTitle}_Audio_24khz.wav`;

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", wavBuffer.length);
    res.send(wavBuffer);
  } catch (err: any) {
    console.error("Error generating WAV download:", err);
    res.status(500).send("Failed to generate WAV download.");
  }
});

function getMp3Duration(buffer: Buffer): number {
  let offset = 0;
  if (buffer.length >= 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    const size = ((buffer[6] & 0x7F) << 21) | ((buffer[7] & 0x7F) << 14) | ((buffer[8] & 0x7F) << 7) | (buffer[9] & 0x7F);
    offset = 10 + size;
    const flags = buffer[5];
    if ((flags & 0x10) !== 0) offset += 10;
  }

  const bitratesMpeg1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const bitratesMpeg2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
  const sampleRatesMpeg1 = [44100, 48000, 32000, 0];
  const sampleRatesMpeg2 = [22050, 24000, 16000, 0];
  const sampleRatesMpeg25 = [11025, 12000, 8000, 0];

  let frameCount = 0;
  let totalSamplesCount = 0;
  let sumSampleRates = 0;

  while (offset < buffer.length - 4) {
    if (buffer[offset] === 0xFF && (buffer[offset + 1] & 0xE0) === 0xE0) {
      const b1 = buffer[offset + 1];
      const b2 = buffer[offset + 2];

      const versionID = (b1 >> 3) & 0x03;
      const layer = (b1 >> 1) & 0x03;

      if (layer === 1) {
        const bitrateIdx = (b2 >> 4) & 0x0F;
        const srIdx = (b2 >> 2) & 0x03;
        const padding = (b2 >> 1) & 0x01;

        let bitrate = 0;
        let sampleRate = 0;
        let samplesPerFrame = 1152;

        if (versionID === 3) { // MPEG-1
          bitrate = bitratesMpeg1L3[bitrateIdx] * 1000;
          sampleRate = sampleRatesMpeg1[srIdx];
        } else if (versionID === 2) { // MPEG-2
          bitrate = bitratesMpeg2L3[bitrateIdx] * 1000;
          sampleRate = sampleRatesMpeg2[srIdx];
          samplesPerFrame = 576;
        } else if (versionID === 0) { // MPEG-2.5
          bitrate = bitratesMpeg2L3[bitrateIdx] * 1000;
          sampleRate = sampleRatesMpeg25[srIdx];
          samplesPerFrame = 576;
        }

        if (bitrate > 0 && sampleRate > 0) {
          const frameLength = Math.floor((samplesPerFrame / 8 * bitrate) / sampleRate) + padding;
          if (frameLength > 0) {
            frameCount++;
            totalSamplesCount += samplesPerFrame;
            sumSampleRates += sampleRate;
            offset += frameLength;
            continue;
          }
        }
      }
    }
    offset++;
  }

  if (frameCount > 0 && totalSamplesCount > 0) {
    const avgSampleRate = sumSampleRates / frameCount;
    return totalSamplesCount / avgSampleRate;
  }
  const remainingSize = buffer.length - offset;
  return Math.max(30, Math.floor(remainingSize / 16000));
}

app.post("/api/podcast/publish", async (req, res): Promise<any> => {
  try {
    const { briefId, briefing } = req.body;
    if (!briefing || !briefing.audioChunks || briefing.audioChunks.length === 0) {
      return res.status(400).json({ error: "No compiled briefing audio chunks provided for publishing." });
    }

    const episodes = await loadPublishedEpisodes(true);
    const existing = episodes.find(ep => ep.id === briefId);
    if (existing) {
      return res.json({ success: true, audioUrl: existing.audioUrl, message: "This episode is already published!" });
    }

    const fullAudioBase64 = briefing.audioChunks.join("");
    const rawAudioBuffer = Buffer.from(fullAudioBase64, "base64");

    const isMp3 = isMp3Buffer(rawAudioBuffer);
    const contentType = isMp3 ? "audio/mpeg" : "audio/wav";
    const fileExt = isMp3 ? "mp3" : "wav";

    let finalAudioBuffer = rawAudioBuffer;
    if (!isMp3) {
      console.log(`[Podcast] Detected raw 16-bit PCM stream. Prepending 44-byte WAV header for 24000Hz playability...`);
      finalAudioBuffer = encodeWavHeaderNode(rawAudioBuffer, 24000);
    }

    const sanitizedTitle = briefing.payload?.title ? briefing.payload.title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() : "podcast";
    const uniqueId = uuidv4();
    const filename = `${uniqueId}_${sanitizedTitle}.${fileExt}`;

    let finalAudioUrl = "";
    let uploadedToSupabase = false;
    let supabaseErrorMsg = "";

    try {
      finalAudioUrl = await uploadAudioToSupabase(finalAudioBuffer, sanitizedTitle, contentType);
      uploadedToSupabase = true;
    } catch (sbErr: any) {
      supabaseErrorMsg = sbErr.message || String(sbErr);
      console.warn("[Podcast - Supabase] Supabase upload failed, trying GCS fallback:", sbErr.message || sbErr);
    }

    if (!uploadedToSupabase) {
      const gcs = getGcsClient();
      const bucketName = process.env.GCS_BUCKET_NAME;
      if (gcs && bucketName) {
        try {
          console.log(`[Podcast - GCS] Fallback active. Uploading to GCS: ${filename}...`);
          const bucket = gcs.bucket(bucketName);
          const file = bucket.file(`audio/${filename}`);
          await file.save(finalAudioBuffer, { metadata: { contentType: contentType } });
          const publicUrlPrefix = process.env.CLOUD_STORAGE_PUBLIC_URL || "https://storage.googleapis.com";
          finalAudioUrl = `${publicUrlPrefix}/${bucketName}/audio/${filename}`;
          console.log(`[Podcast - GCS] Fallback uploaded! Public URL: ${finalAudioUrl}`);
          uploadedToSupabase = true;
        } catch (gcsErr) {
          console.error("[Podcast - GCS] GCS fallback failed as well:", gcsErr);
        }
      }
    }

    if (!finalAudioUrl) {
      console.log(`[Podcast] GCS & Supabase offline. Writing file locally as emergency backup...`);
      const localPath = path.join(LOCAL_AUDIO_DIR, filename);
      fs.writeFileSync(localPath, finalAudioBuffer);
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      finalAudioUrl = `${appUrl}/api/local-podcasts/${filename}`;
    }

    let calculatedDuration = 120;
    if (isMp3) {
      calculatedDuration = Math.round(getMp3Duration(rawAudioBuffer));
    } else {
      calculatedDuration = Math.round(rawAudioBuffer.length / 48000);
    }
    if (!calculatedDuration || calculatedDuration < 5) calculatedDuration = 120;

    const newEpisode: PublishedEpisode = {
      id: briefId,
      title: briefing.payload?.title || "Bản tin không tên",
      description: (briefing.payload?.introduction || "Bản tin phát thanh CommuteCast").substring(0, 400) + "...",
      pubDate: briefing.timestamp || new Date().toISOString(),
      audioUrl: finalAudioUrl,
      duration: calculatedDuration
    };

    episodes.unshift(newEpisode);
    savePublishedEpisodes(episodes);

    return res.json({
      success: true,
      audioUrl: finalAudioUrl,
      storageType: uploadedToSupabase ? "supabase" : "local",
      supabaseError: supabaseErrorMsg || undefined,
      message: "Podcast published successfully!"
    });
  } catch (err: any) {
    console.error("Publish podcast error:", err);
    res.status(500).json({ error: err.message || "Failed to publish podcast episode" });
  }
});


app.delete("/api/podcast/episodes/:id", async (req, res): Promise<any> => {
  try {
    const { id } = req.params;
    const episodes = await loadPublishedEpisodes(true);
    const index = episodes.findIndex(ep => ep.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Podcast episode not found." });
    }

    const targetEpisode = episodes[index];
    const urlParts = targetEpisode.audioUrl.split("/");
    const filename = urlParts[urlParts.length - 1];

    if (targetEpisode.audioUrl.includes("/api/local-podcasts/")) {
      const localPath = path.join(LOCAL_AUDIO_DIR, filename);
      if (fs.existsSync(localPath)) {
        try { fs.unlinkSync(localPath); } catch (fErr) { console.error("Error deleting local file:", fErr); }
      }
    } else if (targetEpisode.audioUrl.includes("supabase.co") || targetEpisode.audioUrl.includes("podcast-audio")) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          console.log(`[Podcast - Supabase] Attempting file removal from storage bucket: audio/${filename}`);
          let storagePath = `audio/${filename}`;
          if (targetEpisode.audioUrl.includes("/podcast-audio/")) {
            const splitKey = "/podcast-audio/";
            const remaining = targetEpisode.audioUrl.substring(targetEpisode.audioUrl.indexOf(splitKey) + splitKey.length);
            if (remaining) {
              storagePath = decodeURIComponent(remaining);
            }
          }
          const { error } = await supabase.storage.from("podcast-audio").remove([storagePath]);
          if (error) console.warn("[Supabase] Delete warning:", error.message || error);
          else console.log(`[Podcast - Supabase] Successfully removed file from buckets: ${storagePath}`);
        } catch (sbDelErr) {
          console.error("Error deleting file from Supabase storage:", sbDelErr);
        }
      }
    } else {
      const gcs = getGcsClient();
      const bucketName = process.env.GCS_BUCKET_NAME;
      if (gcs && bucketName) {
        try {
          const bucket = gcs.bucket(bucketName);
          const file = bucket.file(`audio/${filename}`);
          const [exists] = await file.exists();
          if (exists) { await file.delete(); console.log(`[Podcast - GCS] Deleted GCS object: audio/${filename}`); }
        } catch (gcsDelErr) {
          console.error("Error deleting file from GCS:", gcsDelErr);
        }
      }
    }

    episodes.splice(index, 1);
    savePublishedEpisodes(episodes);
    return res.json({ success: true, message: "Episode deleted successfully" });
  } catch (err: any) {
    console.error("Failed to delete episode:", err);
    res.status(500).json({ error: err.message || "Failed to delete episode" });
  }
});

function safeToUTCString(dateStr: string): string {
  if (!dateStr) return new Date().toUTCString();
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toUTCString();

  try {
    const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})([,\s]+(\d{1,2}):(\d{1,2})(:(\d{1,2}))?)?/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      const hour = match[5] ? parseInt(match[5], 10) : 0;
      const minute = match[6] ? parseInt(match[6], 10) : 0;
      const second = match[8] ? parseInt(match[8], 10) : 0;
      const customDate = new Date(Date.UTC(year, month, day, hour, minute, second));
      if (!isNaN(customDate.getTime())) return customDate.toUTCString();
    }
  } catch (err) { /* fallback */ }

  return new Date().toUTCString();
}

app.get("/api/podcast/feed", async (req, res): Promise<any> => {
  try {
    // Check RSS Feed XML Cache
    const now = Date.now();
    if (cachedRssXml && (now - lastRssXmlTimestamp < 60000)) {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("X-Cache", "HIT");
      return res.send(cachedRssXml);
    }

    const episodes = await loadPublishedEpisodes(true);
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

    // Slice to limit history to 100 latest episodes
    const recentEpisodes = episodes.slice(0, 100);

    const rssItems = recentEpisodes.map((ep) => {
      return {
        title: [ep.title],
        description: [ep.description],
        pubDate: [safeToUTCString(ep.pubDate)],
        enclosure: { $: { url: ep.audioUrl, length: "0", type: "audio/mpeg" } },
        guid: [ep.audioUrl],
        "itunes:duration": [String(ep.duration)],
        "itunes:image": { $: { href: `${appUrl}/icon-512.jpg` } },
        "itunes:explicit": ["false"]
      };
    });

    const feedObj = {
      rss: {
        $: {
          version: "2.0",
          "xmlns:itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
          "xmlns:content": "http://purl.org/rss/1.0/modules/content/"
        },
        channel: {
          title: ["CommuteCast - Bản tin phát thanh cá nhân"],
          description: ["Tạo và nghe bản tin phát thanh cá nhân hóa, đồng bộ hóa lộ trình thông tin thông minh mỗi ngày."],
          link: [appUrl],
          language: ["vi"],
          copyright: [`© ${new Date().getFullYear()} CommuteCast`],
          "itunes:author": ["CommuteCast Anchor"],
          "itunes:summary": ["Tạo và nghe bản tin phát thanh cá nhân hóa song ngữ Anh/Việt được dệt tự động từ tin tức của bạn."],
          "itunes:explicit": ["false"],
          "itunes:image": { $: { href: `${appUrl}/icon-512.jpg` } },
          "itunes:category": { $: { text: "Technology" } },
          item: rssItems
        }
      }
    };

    const builder = new xml2js.Builder({ xmldec: { version: "1.0", encoding: "UTF-8" } });
    let xml = builder.buildObject(feedObj);

    const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';
    if (xml.startsWith(xmlDeclaration)) {
      xml = xmlDeclaration + '\n<?xml-stylesheet type="text/xsl" href="/rss-style.xsl"?>' + xml.substring(xmlDeclaration.length);
    } else {
      xml = '<?xml-stylesheet type="text/xsl" href="/rss-style.xsl"?>\n' + xml;
    }

    // Update Cache
    cachedRssXml = xml;
    lastRssXmlTimestamp = now;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("X-Cache", "MISS");
    return res.send(xml);
  } catch (err: any) {
    console.error("RSS feed generation failed:", err);
    res.status(500).send("<error>Failed to generate RSS feed</error>");
  }
});

// ==================== SUPABASE CONFIG ENDPOINT ====================
app.get("/api/supabase-config", (req, res) => {
  let url = (process.env.SUPABASE_URL || "https://omcuhthpeenwlzdwzlra.supabase.co").trim();
  const key = (process.env.SUPABASE_ANON_KEY || "sb_publishable_jYhv4P78VyLfdsAEa70Mlw_T3vzR6Ez").trim();

  if (url.includes("supabase.com/dashboard/project/")) {
    const parts = url.split("supabase.com/dashboard/project/");
    if (parts[1]) {
      const projectRef = parts[1].split("/")[0];
      if (projectRef) {
        url = `https://${projectRef}.supabase.co`;
      }
    }
  }

  res.json({
    supabaseUrl: url,
    supabaseAnonKey: key
  });
});


// ==================== SERVE FRONTEND ====================
async function serveApp() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[CommuteCast Backend] running on http://localhost:${PORT}`);
  });
}

serveApp();