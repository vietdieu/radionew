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

export interface SummaryPreferences {
  targetDuration: "short" | "medium" | "long";
  tone: "conversational" | "informative" | "upbeat" | "analytical" | "witty";
  voice: "Kore" | "Puck" | "Charon" | "Fenrir" | "Zephyr" | "vi-HN" | "vi-HCM" | "en-UK" | "en-US";
  focus: string;
  commuteType: "driving" | "transit" | "walking" | "cycling";
  customInstructions: string;
  language: "en" | "vi" | "bilingual";
  locationName?: string;       // Ví dụ: "Hà Nội" hoặc "Hồ Chí Minh" để check thời tiết free
  commuteRoute?: string;      // Tuyến đường đi làm, ví dụ: "Đường Nguyễn Trãi" để AI tự tra cứu giao thông
}

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
}

export interface RSSArticle {
  title: string;
  link: string;
  pubDate?: string;
  content?: string;
  feedTitle?: string;
  feedCategory?: string;
  feedType?: "news" | "podcast" | "blog";
}

export interface PublishedEpisode {
  id: string;
  title: string;
  description: string;
  pubDate: string;
  audioUrl: string;
  duration: number;
}

