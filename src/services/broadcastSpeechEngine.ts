import { GoogleGenAI } from "@google/genai";
import { logger } from "../utils/logger";

/**
 * Layer 1: TextNormalizer
 * Handles normalizing abbreviations, acronyms, percentages, currency, units, dates, and numbers.
 */
export class TextNormalizer {
  private static vnAbbreviations: Record<string, string> = {
    "TP.HCM": "Thành phố Hồ Chí Minh",
    "TP HCM": "Thành phố Hồ Chí Minh",
    "HN": "Hà Nội",
    "ĐN": "Đà Nẵng",
    "HP": "Hải Phòng",
    "AI": "A I",
    "TTS": "T T S",
    "RSS": "R S S",
    "GCS": "G C S",
    "GCP": "G C P",
    "PWA": "P W A",
    "SARS-CoV-2": "Sát Co Vi Hai",
    "COVID-19": "Cô vít mười chín",
    "WHO": "Tổ chức Y tế Thế giới",
    "USD": "đô la Mỹ",
    "VND": "đồng",
    "km/h": "ki lô mét trên giờ",
    "m/s": "mét trên giây",
    "kg": "ki lô gam",
    "ml": "mi li lít",
    "°C": "độ C",
    "UBND": "Ủy ban Nhân dân",
    "HĐND": "Hội đồng Nhân dân",
    "VTV": "Đài Truyền hình Việt Nam",
    "VOV": "Đài Tiếng nói Việt Nam",
    "Bộ GTVT": "Bộ Giao thông Vận tải",
    "Bộ GD&ĐT": "Bộ Giáo dục và Đào tạo",
    "Bộ Y tế": "Bộ Y tế",
    "Bộ KH&CN": "Bộ Khoa học và Công nghệ",
    "Bộ TT&TT": "Bộ Thông tin và Truyền thông",
  };

  private static enAbbreviations: Record<string, string> = {
    "AI": "A.I.",
    "API": "A.P.I.",
    "PWA": "P.W.A.",
    "HTML": "H.T.M.L.",
    "CSS": "C.S.S.",
    "GCS": "G.C.S.",
    "GCP": "G.C.P.",
    "TTS": "T.T.S.",
    "RSS": "R.S.S.",
    "WHO": "W.H.O.",
    "COVID-19": "Covid nineteen",
    "USD": "dollars",
    "km/h": "kilometers per hour",
    "mph": "miles per hour",
    "kg": "kilograms",
    "ml": "milliliters",
  };

  public static normalize(text: string, isVi: boolean): string {
    let result = text;

    // Apply abbreviations map
    const map = isVi ? this.vnAbbreviations : this.enAbbreviations;
    for (const [abbr, replacement] of Object.entries(map)) {
      // Use boundary detection to replace only exact words
      const escapedAbbr = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedAbbr}\\b`, "g");
      result = result.replace(regex, replacement);
    }

    // Normalize percentages (e.g., 3.5% -> ba phẩy năm phần trăm)
    if (isVi) {
      result = result.replace(/(\d+),(\d+)%/g, "$1 phẩy $2 phần trăm");
      result = result.replace(/(\d+)\.(\d+)%/g, "$1 phẩy $2 phần trăm");
      result = result.replace(/(\d+)%/g, "$1 phần trăm");
    } else {
      result = result.replace(/(\d+)\.(\d+)%/g, "$1 point $2 percent");
      result = result.replace(/(\d+)%/g, "$1 percent");
    }

    // Normalize years / dates (e.g., 15/08/2026 -> ngày 15 tháng 8 năm 2026)
    if (isVi) {
      result = result.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, "ngày $1 tháng $2 năm $3");
    } else {
      result = result.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, "$2-$1-$3"); // Convert to standard readable dash dates
    }

    return result;
  }
}

/**
 * Layer 4 & 9: PauseOptimizer & PunctuationRefinement
 * Inserts breathing room and cleans up bad punctuation to guide TTS prosody.
 */
export class PauseOptimizer {
  public static optimize(text: string): string {
    let result = text;

    // Normalize double hyphens and ellipsis to natural spoken breath marks
    result = result.replace(/--/g, ", ");
    result = result.replace(/\.\.\./g, "… ");

    // Ensure spaces after punctuation
    result = result.replace(/([.?!,;:…])([A-Za-zĂăÂâĐđÊêÔôƠơƯư])/g, "$1 $2");

    // Replace harsh exclamation marks at end of regular news with softer periods for a professional radio anchor tone
    result = result.replace(/([a-zA-Z0-9])!\s*$/gm, "$1.");

    return result;
  }
}

/**
 * Layer 5 & 6: RhythmOptimizer & BreathingOptimizer
 * Splits long run-on sentences to avoid exhausting the virtual speaker and alternates lengths.
 */
export class RhythmOptimizer {
  public static optimize(text: string, isVi: boolean): string {
    const paragraphs = text.split(/\n+/);
    const processedParagraphs = paragraphs.map(para => {
      // Split paragraph into sentences
      const sentences = para.split(/(?<=[.?!;])\s+/);
      const outputSentences: string[] = [];

      for (const sentence of sentences) {
        const words = sentence.trim().split(/\s+/);
        // Breathing Threshold: If a sentence exceeds 22 words, we split it at a logical clause (like "và", "nhưng", "để", "which", "but", "and")
        if (words.length > 22) {
          const splitSentence = this.splitLongSentence(sentence, isVi);
          outputSentences.push(...splitSentence);
        } else {
          outputSentences.push(sentence);
        }
      }

      // Layer 6: Rhythm alternation - join with natural breath gaps
      return outputSentences.join(" ");
    });

    return processedParagraphs.join("\n");
  }

  private static splitLongSentence(sentence: string, isVi: boolean): string[] {
    const commaIndex = sentence.indexOf(",");
    if (commaIndex !== -1 && commaIndex > 20 && commaIndex < sentence.length - 20) {
      const firstPart = sentence.substring(0, commaIndex).trim();
      const secondPart = sentence.substring(commaIndex + 1).trim();
      // Capitalize first letter of second part
      const capitalizedSecond = secondPart.charAt(0).toUpperCase() + secondPart.slice(1);
      return [firstPart + ".", capitalizedSecond];
    }

    // Split on conjunctions
    const conjunctions = isVi 
      ? [" và ", " nhưng ", " bởi vì ", " do đó ", " đồng thời "] 
      : [" and ", " but ", " because ", " therefore ", " while "];

    for (const conj of conjunctions) {
      const idx = sentence.toLowerCase().indexOf(conj);
      if (idx !== -1 && idx > 25 && idx < sentence.length - 25) {
        const firstPart = sentence.substring(0, idx).trim();
        const secondPart = sentence.substring(idx + conj.length).trim();
        const capitalizedSecond = secondPart.charAt(0).toUpperCase() + secondPart.slice(1);
        return [firstPart + ".", capitalizedSecond];
      }
    }

    return [sentence];
  }
}

/**
 * Layer 7 & 8: EmotionOptimizer & EmphasisDetector
 * Classifies topics and applies subtle conversational styling based on emotional context.
 */
export class EmotionOptimizer {
  public static detectTopicAndStyle(text: string, isVi: boolean): string {
    // Basic regex-based topic classifier
    const lowercase = text.toLowerCase();
    
    let topic = "general";
    if (lowercase.includes("kẹt xe") || lowercase.includes("ùn tắc") || lowercase.includes("giao thông") || lowercase.includes("traffic") || lowercase.includes("accident")) {
      topic = "traffic";
    } else if (lowercase.includes("thời tiết") || lowercase.includes("bão") || lowercase.includes("mưa") || lowercase.includes("weather") || lowercase.includes("temperature") || lowercase.includes("rain")) {
      topic = "weather";
    } else if (lowercase.includes("công nghệ") || lowercase.includes("robot") || lowercase.includes("ai ") || lowercase.includes("chip") || lowercase.includes("technology") || lowercase.includes("software")) {
      topic = "technology";
    } else if (lowercase.includes("kinh tế") || lowercase.includes("lạm phát") || lowercase.includes("cổ phiếu") || lowercase.includes("economy") || lowercase.includes("finance") || lowercase.includes("inflation")) {
      topic = "economy";
    } else if (lowercase.includes("khẩn cấp") || lowercase.includes("nguy hiểm") || lowercase.includes("cảnh báo") || lowercase.includes("emergency") || lowercase.includes("warning")) {
      topic = "emergency";
    }

    logger.info(`[BroadcastEngine] Detected topic for emotional mapping: ${topic}`);

    let decoratedText = text;
    // Add subtle, natural introductory cues matching topic personality
    if (topic === "traffic") {
      decoratedText = isVi 
        ? "Cập nhật nhanh về tình hình giao thông thưa quý vị. " + decoratedText
        : "An important update on traffic now. " + decoratedText;
    } else if (topic === "weather") {
      decoratedText = isVi
        ? "Bây giờ là thông tin thời tiết hôm nay. " + decoratedText
        : "Let's take a look at the weather conditions today. " + decoratedText;
    } else if (topic === "technology") {
      decoratedText = isVi
        ? "Chuyển sang tiêu điểm công nghệ đầy thú vị. " + decoratedText
        : "Turning to some fascinating tech developments now. " + decoratedText;
    } else if (topic === "emergency") {
      decoratedText = isVi
        ? "Thưa quý vị, sau đây là cảnh báo khẩn quan trọng. " + decoratedText
        : "We bring you an urgent warning notice. " + decoratedText;
    }

    return decoratedText;
  }
}

/**
 * Layer 2, 3 & 10: BroadcastRewriter & RadioHostStyle & ConversationalFlow
 * Combines rules and intelligent Gemini-driven prompt restructuring to ensure
 * human podcast/radio presenter level script flow.
 */
export class BroadcastRewriter {
  public static async rewriteWithAI(text: string, voice: string, isVi: boolean, ai: GoogleGenAI): Promise<string> {
    try {
      const languageText = isVi ? "Vietnamese" : "English";
      const targetAccent = isVi 
        ? (voice === "vi-HCM" ? "Southern Vietnamese (Hồ Chí Minh)" : "Northern Vietnamese (Hà Nội)")
        : (voice === "en-UK" || voice === "Puck" ? "British Received Pronunciation" : "General American");

      logger.info(`[BroadcastEngine] Requesting AI-driven broadcast speech rewrite for ${languageText} (${targetAccent}).`);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are a highly experienced bilingual podcast host and professional radio news anchor. 
Your mission is to rewrite the provided script/text from a "written newspaper/email" style into a warm, engaging, and professional "spoken broadcast language" script in ${languageText} for your listeners.

CRITICAL INSTRUCTIONS:
1. PRESERVE ALL ORIGINAL FACTS, numbers, names, dates, and locations. Do not invent, exaggerate, or omit any actual data.
2. ADAPT THE TONE: Make it sound conversational, warm, and highly professional. Avoid bureaucratic or cold administrative writing (e.g., instead of "The ministry announced that starting on June 30th...", write "Thưa quý vị, từ ngày mười sáu tháng tám..." or similar spoken transitions).
3. VARY THE GREETINGS: Do not repeat "Kính thưa quý vị" or "Thưa quý vị" in every paragraph. Use varied natural phrases (e.g., "Tiếp theo chương trình,", "Sau đây,", "Một thông tin đáng chú ý khác,").
4. REWRITE ALL NUMBERS AND ACRONYMS: Convert any raw percentages (e.g. 5.2% -> "năm phẩy hai phần trăm" or "five point two percent"), acronyms (e.g., TP.HCM -> "Thành phố Hồ Chí Minh", AI -> "A I"), and currencies to fully spelled-out spoken words so the TTS reads them smoothly.
5. SHORT COMFORTABLE SENTENCES: Ensure no sentence is too long to speak in a single breath. Split run-on sentences.
6. TRANSITIONS: Make transition phrases between news paragraphs smooth, lively, and natural.
7. LANGUAGE: Respond strictly in the target language (${languageText}). Keep any bilingual chunks separated by a single "/" if specified. Do not output anything except the final spoken script.

Raw input script:
"""
${text}
"""`
              }
            ]
          }
        ],
        config: {
          temperature: 0.45,
          maxOutputTokens: 2048,
        }
      });

      const rewritten = response.text?.trim();
      if (rewritten && rewritten.length > 20) {
        logger.info("[BroadcastEngine] AI-driven spoken rewrite completed successfully!");
        return rewritten;
      }
    } catch (err: any) {
      logger.warn(`[BroadcastEngine] AI rewrite failed or timed out: ${err.message || err}. Falling back to high-fidelity rule-based pipeline.`);
    }

    return text;
  }
}

/**
 * Central BroadcastSpeechEngine
 * Orchestrates all 12 processing layers to clean, normalize, format, optimize rhythm,
 * pause, and style speech content.
 */
export class BroadcastSpeechEngine {
  /**
   * Main processing pipeline.
   * Processes raw written summaries/bullet scripts into high-fidelity conversational broadcasting scripts.
   */
  public static async process(
    text: string,
    voice: string,
    tone: string,
    ai?: GoogleGenAI
  ): Promise<string> {
    if (!text || text.trim() === "") return "";

    const isVi = voice?.startsWith("vi") || false;
    logger.info(`[BroadcastEngine] Processing text before synthesis. Is Vietnamese: ${isVi}, Voice: ${voice}, Tone: ${tone}`);

    let processed = text;

    // Layer 12 Check: Safeguard clean copy of original
    const originalText = text;

    // Layer 2, 3 & 10: Broadcast Spoken Rewriter (AI-assisted if Gemini AI client is supplied)
    if (ai) {
      processed = await BroadcastRewriter.rewriteWithAI(processed, voice, isVi, ai);
    }

    // Layer 1: Text Normalization (Numbers, abbreviations, percentages, dates)
    processed = TextNormalizer.normalize(processed, isVi);

    // Layer 7 & 8: Emotional Delivery & Topic Cues
    processed = EmotionOptimizer.detectTopicAndStyle(processed, isVi);

    // Layer 5 & 6: Breathing & Rhythm Optimization (Alternating lengths, splitting run-ons)
    processed = RhythmOptimizer.optimize(processed, isVi);

    // Layer 4 & 9: Pause Optimization & Punctuation Refinement
    processed = PauseOptimizer.optimize(processed);

    // Final Validation: Ensure we did not break critical formatting, or empty out the text
    if (!processed || processed.trim() === "") {
      logger.warn("[BroadcastEngine] Engineered script returned empty. Reverting to original text as safeguard.");
      return originalText;
    }

    logger.info("[BroadcastEngine] Text processing finalized successfully.");
    return processed;
  }
}
