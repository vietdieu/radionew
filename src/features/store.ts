// src/features/store.ts
import { VoiceProfile, AIMemoryItem, PersonalizedMemory, ListenStats, QueueItem, FeatureSettings, AccessibilityConfig } from "./types";

// Keys
const KEYS = {
  VOICE_PROFILE: "cc_voice_profile",
  AI_MEMORY: "cc_ai_memory",
  STATS: "cc_stats",
  QUEUE: "cc_queue",
  ACCESSIBILITY: "cc_accessibility",
  SETTINGS: "cc_feature_settings",
  HISTORY: "cc_playback_history",
  FAVORITES: "cc_favorite_ids",
  REPEAT_MODE: "cc_repeat_mode",
  AUTO_CONTINUE: "cc_auto_continue"
};

const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  speed: 1.0,
  pitch: 1.0,
  volume: 0.9,
  vietnameseVoice: "vi-HN",
  englishVoice: "en-US"
};

const DEFAULT_ACCESSIBILITY: AccessibilityConfig = {
  highContrast: false,
  reducedMotion: false,
  largeFont: false,
  keyboardOnly: false
};

const DEFAULT_SETTINGS: FeatureSettings = {
  voiceProfile: DEFAULT_VOICE_PROFILE,
  accessibility: DEFAULT_ACCESSIBILITY,
  pwaNotificationsEnabled: true,
  offlineDownloadsAuto: false
};

const DEFAULT_MEMORY: PersonalizedMemory = {
  favoriteTopics: [],
  preferredLanguage: "bilingual",
  preferredSources: [],
  totalListeningSeconds: 0,
  lastActiveDate: new Date().toLocaleDateString()
};

const DEFAULT_STATS: ListenStats = {
  totalSeconds: 0,
  totalStoriesRead: 0,
  byLanguage: { vi: 0, en: 0, bilingual: 0 },
  byCategory: {},
  byFeedSource: {},
  dailyHistory: [
    { date: "Mon", seconds: 120 },
    { date: "Tue", seconds: 450 },
    { date: "Wed", seconds: 300 },
    { date: "Thu", seconds: 600 },
    { date: "Fri", seconds: 150 },
    { date: "Sat", seconds: 0 },
    { date: "Sun", seconds: 0 }
  ]
};

// Simple event target to notify components on update
class FeatureEventEmitter extends EventTarget {
  emitChange() {
    this.dispatchEvent(new Event("change"));
  }
}
export const featureStoreEvents = new FeatureEventEmitter();

// Safe storage accessors
export const getVoiceProfile = (): VoiceProfile => {
  try {
    const saved = localStorage.getItem(KEYS.VOICE_PROFILE);
    return saved ? JSON.parse(saved) : DEFAULT_VOICE_PROFILE;
  } catch {
    return DEFAULT_VOICE_PROFILE;
  }
};

export const saveVoiceProfile = (profile: VoiceProfile) => {
  try {
    localStorage.setItem(KEYS.VOICE_PROFILE, JSON.stringify(profile));
    featureStoreEvents.emitChange();
  } catch (e) {
    console.warn("Failed to save voice profile:", e);
  }
};

export const getAccessibilityConfig = (): AccessibilityConfig => {
  try {
    const saved = localStorage.getItem(KEYS.ACCESSIBILITY);
    return saved ? JSON.parse(saved) : DEFAULT_ACCESSIBILITY;
  } catch {
    return DEFAULT_ACCESSIBILITY;
  }
};

export const saveAccessibilityConfig = (config: AccessibilityConfig) => {
  try {
    localStorage.setItem(KEYS.ACCESSIBILITY, JSON.stringify(config));
    // Apply visual effects globally
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (config.highContrast) {
        root.classList.add("high-contrast");
      } else {
        root.classList.remove("high-contrast");
      }
      if (config.largeFont) {
        root.classList.add("text-lg");
      } else {
        root.classList.remove("text-lg");
      }
      if (config.reducedMotion) {
        root.classList.add("motion-reduce");
      } else {
        root.classList.remove("motion-reduce");
      }
    }
    featureStoreEvents.emitChange();
  } catch (e) {
    console.warn("Failed to save accessibility settings:", e);
  }
};

export const getFeatureSettings = (): FeatureSettings => {
  try {
    const saved = localStorage.getItem(KEYS.SETTINGS);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    voiceProfile: getVoiceProfile(),
    accessibility: getAccessibilityConfig(),
    pwaNotificationsEnabled: true,
    offlineDownloadsAuto: false
  };
};

export const saveFeatureSettings = (settings: FeatureSettings) => {
  try {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    saveVoiceProfile(settings.voiceProfile);
    saveAccessibilityConfig(settings.accessibility);
    featureStoreEvents.emitChange();
  } catch (e) {
    console.warn("Failed to save feature settings:", e);
  }
};

export const getPersonalMemory = (): PersonalizedMemory => {
  try {
    const saved = localStorage.getItem(KEYS.AI_MEMORY);
    return saved ? JSON.parse(saved) : DEFAULT_MEMORY;
  } catch {
    return DEFAULT_MEMORY;
  }
};

export const savePersonalMemory = (memory: PersonalizedMemory) => {
  try {
    localStorage.setItem(KEYS.AI_MEMORY, JSON.stringify(memory));
    featureStoreEvents.emitChange();
  } catch (e) {
    console.warn("Failed to save personal memory:", e);
  }
};

export const clearPersonalMemory = () => {
  savePersonalMemory(DEFAULT_MEMORY);
};

export const getListenStats = (): ListenStats => {
  try {
    const saved = localStorage.getItem(KEYS.STATS);
    return saved ? JSON.parse(saved) : DEFAULT_STATS;
  } catch {
    return DEFAULT_STATS;
  }
};

export const saveListenStats = (stats: ListenStats) => {
  try {
    localStorage.setItem(KEYS.STATS, JSON.stringify(stats));
    featureStoreEvents.emitChange();
  } catch (e) {
    console.warn("Failed to save stats:", e);
  }
};

export const recordListeningSession = (seconds: number, language: "vi" | "en" | "bilingual", category = "News", source = "CommuteCast Feed") => {
  const stats = getListenStats();
  const memory = getPersonalMemory();

  // 1. Update statistics
  stats.totalSeconds += seconds;
  stats.totalStoriesRead += 1;
  stats.byLanguage[language] = (stats.byLanguage[language] || 0) + 1;
  stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
  stats.byFeedSource[source] = (stats.byFeedSource[source] || 0) + 1;

  // Add to dailyHistory (last item matching today's weekday)
  const today = new Date().toLocaleDateString("en-US", { weekday: "short" });
  const index = stats.dailyHistory.findIndex(d => d.date === today);
  if (index !== -1) {
    stats.dailyHistory[index].seconds += seconds;
  } else {
    // shift or add
    if (stats.dailyHistory.length >= 7) {
      stats.dailyHistory.shift();
    }
    stats.dailyHistory.push({ date: today, seconds });
  }
  saveListenStats(stats);

  // 2. Update AI Personalized Memory
  const existingTopicIndex = memory.favoriteTopics.findIndex(t => t.topic.toLowerCase() === category.toLowerCase());
  if (existingTopicIndex !== -1) {
    memory.favoriteTopics[existingTopicIndex].interactedCount += 1;
    memory.favoriteTopics[existingTopicIndex].lastInteractedAt = new Date().toISOString();
  } else {
    memory.favoriteTopics.push({
      id: Math.random().toString(),
      topic: category,
      category,
      interactedCount: 1,
      lastInteractedAt: new Date().toISOString()
    });
  }
  
  memory.totalListeningSeconds += seconds;
  if (!memory.preferredSources.includes(source)) {
    memory.preferredSources.push(source);
    if (memory.preferredSources.length > 5) {
      memory.preferredSources.shift();
    }
  }
  memory.preferredLanguage = language;
  memory.lastActiveDate = new Date().toLocaleDateString();

  savePersonalMemory(memory);
};

// Smart Queue persistence & management
export const getPlayQueue = (): QueueItem[] => {
  try {
    const saved = localStorage.getItem(KEYS.QUEUE);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const savePlayQueue = (queue: QueueItem[]) => {
  try {
    localStorage.setItem(KEYS.QUEUE, JSON.stringify(queue));
    featureStoreEvents.emitChange();
  } catch (e) {
    console.warn("Failed to save queue:", e);
  }
};

export const addToQueue = (item: QueueItem) => {
  const queue = getPlayQueue();
  if (!queue.some(q => q.id === item.id)) {
    queue.push(item);
    savePlayQueue(queue);
  }
};

export const removeFromQueue = (id: string) => {
  const queue = getPlayQueue();
  const updated = queue.filter(q => q.id !== id);
  savePlayQueue(updated);
};

export const clearQueue = () => {
  savePlayQueue([]);
};

// Playback History
export const getPlaybackHistory = (): QueueItem[] => {
  try {
    const saved = localStorage.getItem(KEYS.HISTORY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const savePlaybackHistory = (history: QueueItem[]) => {
  try {
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
    featureStoreEvents.emitChange();
  } catch (e) {
    console.warn("Failed to save history:", e);
  }
};

export const addToPlaybackHistory = (item: QueueItem) => {
  const history = getPlaybackHistory();
  const filtered = history.filter(h => h.id !== item.id);
  // Max 30 items
  const updated = [item, ...filtered].slice(0, 30);
  savePlaybackHistory(updated);
};

export const clearPlaybackHistory = () => {
  savePlaybackHistory([]);
};

// Favorites
export const getFavoriteIds = (): string[] => {
  try {
    const saved = localStorage.getItem(KEYS.FAVORITES);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const saveFavoriteIds = (ids: string[]) => {
  try {
    localStorage.setItem(KEYS.FAVORITES, JSON.stringify(ids));
    featureStoreEvents.emitChange();
  } catch (e) {
    console.warn("Failed to save favorites:", e);
  }
};

export const toggleFavoriteId = (id: string) => {
  const ids = getFavoriteIds();
  const updated = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
  saveFavoriteIds(updated);
};

// Repeat Mode: "off" | "all" | "one"
export const getRepeatMode = (): "off" | "all" | "one" => {
  try {
    const saved = localStorage.getItem(KEYS.REPEAT_MODE);
    return (saved as any) || "off";
  } catch {
    return "off";
  }
};

export const setRepeatMode = (mode: "off" | "all" | "one") => {
  try {
    localStorage.setItem(KEYS.REPEAT_MODE, mode);
    featureStoreEvents.emitChange();
  } catch (e) {
    console.warn("Failed to save repeat mode:", e);
  }
};

// Auto Continue
export const getAutoContinue = (): boolean => {
  try {
    const saved = localStorage.getItem(KEYS.AUTO_CONTINUE);
    return saved !== null ? saved === "true" : true;
  } catch {
    return true;
  }
};

export const setAutoContinue = (enabled: boolean) => {
  try {
    localStorage.setItem(KEYS.AUTO_CONTINUE, String(enabled));
    featureStoreEvents.emitChange();
  } catch (e) {
    console.warn("Failed to save auto continue:", e);
  }
};
