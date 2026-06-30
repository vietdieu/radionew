// src/features/types.ts

export interface VoiceProfile {
  speed: number;       // Reading speed, e.g., 0.5 to 2.0
  pitch: number;       // Cao độ, e.g., 0.5 to 1.5
  volume: number;      // Âm lượng, e.g., 0 to 1
  vietnameseVoice: string; // 'vi-HN' | 'vi-HCM'
  englishVoice: string;    // 'en-US' | 'en-UK' | 'Kore' | 'Puck' etc.
}

export interface AIMemoryItem {
  id: string;
  topic: string;
  category: string;
  interactedCount: number;
  lastInteractedAt: string;
}

export interface PersonalizedMemory {
  favoriteTopics: AIMemoryItem[];
  preferredLanguage: "vi" | "en" | "bilingual";
  preferredSources: string[]; // List of feed titles often listened to
  totalListeningSeconds: number;
  lastActiveDate: string;
}

export interface ListenStats {
  totalSeconds: number;
  totalStoriesRead: number;
  byLanguage: { vi: number; en: number; bilingual: number };
  byCategory: { [category: string]: number };
  byFeedSource: { [feedTitle: string]: number };
  dailyHistory: { date: string; seconds: number }[]; // for dynamic chart rendering
}

export interface QueueItem {
  id: string;
  title: string;
  subtitle: string;
  audioUrl?: string; // or pcm audio chunk index
  duration?: number;
  type: "rss" | "podcast" | "custom";
  payload?: any; // any extra summary payload
}

export interface AccessibilityConfig {
  highContrast: boolean;
  reducedMotion: boolean;
  largeFont: boolean;
  keyboardOnly: boolean; // emphasizes visible focus outlines
}

export interface FeatureSettings {
  voiceProfile: VoiceProfile;
  accessibility: AccessibilityConfig;
  pwaNotificationsEnabled: boolean;
  offlineDownloadsAuto: boolean; // Auto-download new RSS summaries
}
