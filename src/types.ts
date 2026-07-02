export enum LanguageMode {
  VN_ONLY = "VN_ONLY",
  EN_ONLY = "EN_ONLY",
  BILINGUAL = "BILINGUAL"
}

export interface NewsChapter {
  topic: string;
  scriptText: string;
  summaryBullets: string[];
}

export interface SummaryPayload {
  title: string;
  introduction: string;
  chapters: NewsChapter[];
  conclusion: string;
}

export interface BroadcastConfiguration {
  languageMode: LanguageMode;
  language: "vi" | "en" | "bilingual"; // legacy compatibility
  voiceVN: string;
  voiceEN: string;
  rate: number;
  speed: number; // legacy compatibility
  pitch: number;
  isDrivingMode: boolean;
  targetDuration: "short" | "medium" | "long";
  tone: "conversational" | "informative" | "upbeat" | "analytical" | "witty";
  focus: string;
  commuteType: "driving" | "transit" | "walking" | "cycling";
  customInstructions: string;
  locationName?: string;
  commuteRoute?: string;
  voice: "Kore" | "Puck" | "Charon" | "Fenrir" | "Zephyr" | "vi-HN" | "vi-HCM" | "en-UK" | "en-US" | string;
  aiMode?: "rewrite" | "fact_check" | "detect_duplicate" | "podcast_style" | "morning_style" | "driving_style" | "student_mode" | "executive_mode" | "english_learning_mode" | string;
  audioEmotion?: string;
  audioPauseDuration?: number;
  audioPronunciationDict?: Array<{ word: string; replace: string }>;
  audioMusicGenre?: string;
  audioMusicVolume?: number;
  audioNormalize?: boolean;
  audioLimiter?: boolean;
  audioFadeDuration?: number;
  audioNoiseReduction?: boolean;
}

export interface SummaryPreferences extends BroadcastConfiguration {}

export interface SavedSummary {
  id: string;
  timestamp: string;
  preferences: SummaryPreferences;
  payload: SummaryPayload;
  audioChunks?: string[]; // Base64 audio strings match: [Intro, ...Chapters, Conclusion]
  likeCount?: number;
  shareCount?: number;
}

export interface VoiceHistoryItem {
  id: string;
  timestamp: string;
  query: string;
  answer: string;
  language: "vi" | "en";
  sources?: Array<{ title: string; uri: string }>;
}

export interface RSSFeed {
  id: string;
  url: string;
  title: string;
  category?: string;
  feedType?: "news" | "podcast" | "blog";
  addedAt: string;
  lastFetchedAt?: string;
  // Sprint 1 RSS Studio Optional Fields
  priority?: "low" | "medium" | "high";
  healthStatus?: "healthy" | "unstable" | "failing";
  healthError?: string;
  fetchCount?: number;
  successCount?: number;
  avgFetchDuration?: number; // duration in ms
}

export interface RSSArticle {
  title: string;
  link: string;
  pubDate?: string;
  content?: string;
  feedTitle?: string;
  feedCategory?: string;
  feedType?: "news" | "podcast" | "blog";
  feedId?: string; // Optional reference to parent feed
  isDuplicate?: boolean; // Sprint 1 duplicate detection flag
}

export interface PublishedEpisode {
  id: string;
  title: string;
  description: string;
  pubDate: string;
  audioUrl: string;
  duration: number;
}

