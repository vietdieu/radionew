import { SavedSummary, VoiceHistoryItem, RSSFeed } from "../types";

const DB_NAME = "CommuteCastDB";
const STORE_NAME = "briefings_store";
const VOICE_HISTORY_STORE = "voiceHistory";
const RSS_FEEDS_STORE = "rssFeeds";
const DB_VERSION = 7; // Tăng version lên 7 để đảm bảo onupgradeneeded luôn chạy trên tất cả trình duyệt người dùng, giải quyết dứt điểm chỉ mục url_idx
const MAX_BRIEFINGS_LIMIT = 50; // Tự động xóa bớt khi vượt quá
const LOCAL_STORAGE_FALLBACK_KEY_VI = "commute_cast_history_vi";
const LOCAL_STORAGE_FALLBACK_KEY_EN = "commute_cast_history_en";
const LOCAL_STORAGE_RSS_KEY = "commute_cast_rss_feeds";
const LOCAL_STORAGE_VOICE_KEY = "commute_cast_voice_history";

// ================== KIỂM TRA HỖ TRỢ ==================
export function isIndexedDBSupported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

// ================== MỞ KẾT NỐI INDEXEDDB ==================
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBSupported()) {
      reject(new Error("IndexedDB is not supported on this browser."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      const transaction = event.target.transaction;
      // Tạo object stores nếu chưa tồn tại
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        // Thêm chỉ mục để tăng tốc truy vấn
        store.createIndex("timestamp_idx", "timestamp", { unique: false });
        store.createIndex("language_idx", "preferences.language", { unique: false });
      }
      if (!db.objectStoreNames.contains(VOICE_HISTORY_STORE)) {
        const store = db.createObjectStore(VOICE_HISTORY_STORE, { keyPath: "id" });
        store.createIndex("timestamp_idx", "timestamp", { unique: false });
      }
      if (!db.objectStoreNames.contains(RSS_FEEDS_STORE)) {
        const store = db.createObjectStore(RSS_FEEDS_STORE, { keyPath: "id" });
        store.createIndex("url_idx", "url", { unique: false });
      } else {
        // Nếu đã tồn tại, xóa chỉ mục cũ có thuộc tính unique: true và tạo lại chỉ mục unique: false để tránh ConstraintError
        try {
          const store = transaction.objectStore(RSS_FEEDS_STORE);
          if (store.indexNames.contains("url_idx")) {
            store.deleteIndex("url_idx");
          }
          store.createIndex("url_idx", "url", { unique: false });
        } catch (e) {
          console.warn("Lỗi cập nhật chỉ mục RSS_FEEDS_STORE:", e);
        }
      }
      if (!db.objectStoreNames.contains("audios")) {
        const store = db.createObjectStore("audios", { keyPath: "id" });
        store.createIndex("timestamp_idx", "timestamp", { unique: false });
      }
    };

    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error || new Error("Failed to open IndexedDB"));
  });
}

// ================== HÀM CHUẨN HÓA BRIEFING ==================
export function normalizeBriefing(item: any): SavedSummary {
  if (!item || typeof item !== "object") {
    item = {};
  }
  const id = item.id || `brief-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = item.timestamp || item.createdAt || new Date().toLocaleString();
  const preferences = item.preferences || {
    targetDuration: "medium",
    tone: "conversational",
    voice: "Kore",
    focus: "",
    commuteType: "driving",
    customInstructions: "",
    language: item.language || "vi"
  };

  const payload = item.payload || {
    title: item.title || "CommuteCast Briefing",
    introduction: item.introduction || "",
    chapters: item.chapters || [],
    conclusion: item.conclusion || ""
  };

  // Đảm bảo audioChunks là mảng
  let audioChunks = item.audioChunks || [];
  if (audioChunks.length === 0 && item.audioBase64) {
    audioChunks = [item.audioBase64];
  }

  return {
    id,
    timestamp,
    preferences: {
      targetDuration: preferences.targetDuration || "medium",
      tone: preferences.tone || "conversational",
      voice: preferences.voice || "Kore",
      focus: preferences.focus || "",
      commuteType: preferences.commuteType || "driving",
      customInstructions: preferences.customInstructions || "",
      language: preferences.language || "vi"
    },
    payload: {
      title: payload.title || "CommuteCast Briefing",
      introduction: payload.introduction || "",
      chapters: Array.isArray(payload.chapters) ? payload.chapters.map((ch: any) => ({
        topic: ch.topic || "",
        scriptText: ch.scriptText || "",
        summaryBullets: Array.isArray(ch.summaryBullets) ? ch.summaryBullets : []
      })) : [],
      conclusion: payload.conclusion || ""
    },
    audioChunks: Array.isArray(audioChunks) ? audioChunks.map(String) : [],
    likeCount: typeof item.likeCount === "number" ? item.likeCount : 0,
    shareCount: typeof item.shareCount === "number" ? item.shareCount : 0
  };
}

// ================== ƯỚC LƯỢNG DUNG LƯỢNG ==================
export async function getStorageEstimate(): Promise<{ usedMB: number; totalMB?: number }> {
  let actualMB = 0;
  try {
    if (isIndexedDBSupported()) {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      actualMB = await new Promise<number>((resolve) => {
        let totalBytes = 0;
        const request = store.openCursor();
        request.onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor) {
            const value = cursor.value;
            const serialized = JSON.stringify(value);
            totalBytes += serialized.length;
            cursor.continue();
          } else {
            resolve(parseFloat((totalBytes / (1024 * 1024)).toFixed(2)));
          }
        };
        request.onerror = () => resolve(0);
      });
    } else {
      // Fallback localStorage
      const listVi = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY_VI) || "";
      const listEn = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY_EN) || "";
      actualMB = parseFloat(((listVi.length + listEn.length) / (1024 * 1024)).toFixed(2));
    }
  } catch (err) {
    console.warn("Storage estimate failed", err);
  }

  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usedMB = actualMB > 0 ? actualMB : (estimate.usage ? parseFloat((estimate.usage / (1024 * 1024)).toFixed(2)) : 0);
      const totalMB = estimate.quota ? parseFloat((estimate.quota / (1024 * 1024)).toFixed(2)) : undefined;
      return { usedMB, totalMB };
    } catch (e) {
      /* ignore */
    }
  }
  return { usedMB: actualMB };
}

// ================== LƯU BRIEFING ==================
export async function saveBriefing(briefing: any): Promise<void> {
  const normalized = normalizeBriefing(briefing);

  if (!isIndexedDBSupported()) {
    console.warn("IndexedDB not supported, using localStorage fallback.");
    const key = normalized.preferences.language === "en" ? LOCAL_STORAGE_FALLBACK_KEY_EN : LOCAL_STORAGE_FALLBACK_KEY_VI;
    try {
      const current = localStorage.getItem(key);
      const list: any[] = current ? JSON.parse(current) : [];
      const filtered = list.filter((item: any) => item.id !== normalized.id);
      filtered.unshift(normalized);
      const pruned = filtered.slice(0, MAX_BRIEFINGS_LIMIT);
      localStorage.setItem(key, JSON.stringify(pruned));
    } catch (err: any) {
      console.error("localStorage quota exceeded during fallback save:", err);
      throw new Error("STORAGE_QUOTA_EXCEEDED");
    }
    return;
  }

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    // Kiểm tra tồn tại để giữ lại audio nếu chưa có
    const existing = await new Promise<any>((resolve) => {
      const getReq = store.get(normalized.id);
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => resolve(null);
    });

    if (existing) {
      if ((!normalized.audioChunks || normalized.audioChunks.length === 0) && existing.audioChunks?.length > 0) {
        normalized.audioChunks = existing.audioChunks;
      }
      if (!(normalized as any).audioBase64 && existing.audioBase64) {
        (normalized as any).audioBase64 = existing.audioBase64;
      }
      if (!(normalized as any).audioUrl && existing.audioUrl) {
        (normalized as any).audioUrl = existing.audioUrl;
      }
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error("Transaction aborted"));
      store.put(normalized);
    });

    // Tự động giới hạn số lượng - Bây giờ giao dịch ghi đã hoàn thành và khóa được giải phóng
    const all = await getAllBriefings(false);
    if (all.length > MAX_BRIEFINGS_LIMIT) {
      const sorted = [...all].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const toDelete = sorted.length - MAX_BRIEFINGS_LIMIT;
      for (let i = 0; i < toDelete; i++) {
        await deleteBriefing(sorted[i].id);
      }
    }
  } catch (err: any) {
    if (err.name === "QuotaExceededError" || err.message?.includes("quota")) {
      throw new Error("STORAGE_QUOTA_EXCEEDED");
    }
    throw err;
  }
}

// ================== LẤY TẤT CẢ BRIEFING ==================
export async function getAllBriefings(includeAudio = true): Promise<SavedSummary[]> {
  if (!isIndexedDBSupported()) {
    const listVi = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY_VI);
    const listEn = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY_EN);
    const combined = [...(listVi ? JSON.parse(listVi) : []), ...(listEn ? JSON.parse(listEn) : [])];
    const normalized = combined.map(normalizeBriefing);
    if (!includeAudio) {
      return normalized.map((item) => {
        const { audioChunks, audioBase64, ...rest } = item as any;
        return rest as SavedSummary;
      });
    }
    return normalized;
  }

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const items = await new Promise<SavedSummary[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    const normalized = items.map(normalizeBriefing);
    if (!includeAudio) {
      return normalized.map((item) => {
        const { audioChunks, audioBase64, ...rest } = item as any;
        return rest as SavedSummary;
      });
    }
    return normalized.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    console.warn("Failed to retrieve briefings from IndexedDB", err);
    return [];
  }
}

// ================== LẤY MỘT BRIEFING ==================
export async function getBriefing(id: string): Promise<SavedSummary | null> {
  if (!isIndexedDBSupported()) {
    const all = await getAllBriefings(true);
    return all.find((item) => item.id === id) || null;
  }

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const result = await new Promise<any>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    return result ? normalizeBriefing(result) : null;
  } catch (err) {
    console.warn(`Failed to get briefing ${id}`, err);
    return null;
  }
}

// ================== XÓA MỘT BRIEFING ==================
export async function deleteBriefing(id: string): Promise<void> {
  if (!isIndexedDBSupported()) {
    for (const key of [LOCAL_STORAGE_FALLBACK_KEY_VI, LOCAL_STORAGE_FALLBACK_KEY_EN]) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        const filtered = parsed.filter((item: any) => item.id !== id);
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    }
    return;
  }

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`Failed to delete briefing ${id}`, err);
    throw err;
  }
}

// ================== XÓA TẤT CẢ BRIEFING ==================
export async function clearAll(): Promise<void> {
  if (!isIndexedDBSupported()) {
    localStorage.removeItem(LOCAL_STORAGE_FALLBACK_KEY_VI);
    localStorage.removeItem(LOCAL_STORAGE_FALLBACK_KEY_EN);
    return;
  }

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Failed to clear briefings database", err);
    throw err;
  }
}

// ================== DI CHUYỂN DỮ LIỆU TỪ LOCALSTORAGE ==================
export async function migrateLegacyLocalStorageData(): Promise<number> {
  let migratedCount = 0;
  try {
    for (const key of [LOCAL_STORAGE_FALLBACK_KEY_VI, LOCAL_STORAGE_FALLBACK_KEY_EN]) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const list = JSON.parse(stored);
        if (Array.isArray(list) && list.length > 0) {
          console.log(`Migrating ${list.length} items from localStorage key "${key}"...`);
          for (const item of list) {
            await saveBriefing(normalizeBriefing(item));
            migratedCount++;
          }
          localStorage.removeItem(key);
        }
      }
    }
  } catch (err) {
    console.error("Migration failed:", err);
  }
  return migratedCount;
}

// ================== VOICE HISTORY ==================
export async function saveVoiceHistory(item: Partial<VoiceHistoryItem>): Promise<VoiceHistoryItem> {
  const id = item.id || `vh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const timestamp = item.timestamp || new Date().toLocaleString();
  const record: VoiceHistoryItem = {
    id: String(id),
    timestamp: String(timestamp),
    query: String(item.query || ""),
    answer: String(item.answer || ""),
    language: (item.language === "en" || item.language === "vi") ? item.language : "vi",
    sources: Array.isArray(item.sources) ? item.sources.map((s: any) => ({
      title: String(s?.title || ""),
      uri: String(s?.uri || "")
    })) : []
  };

  if (!isIndexedDBSupported()) {
    try {
      const current = localStorage.getItem(LOCAL_STORAGE_VOICE_KEY);
      const list = current ? JSON.parse(current) : [];
      list.unshift(record);
      localStorage.setItem(LOCAL_STORAGE_VOICE_KEY, JSON.stringify(list.slice(0, 50)));
    } catch (err) {
      console.warn("Failed to save voice history to localStorage", err);
    }
    return record;
  }

  try {
    const db = await openDB();
    const tx = db.transaction(VOICE_HISTORY_STORE, "readwrite");
    const store = tx.objectStore(VOICE_HISTORY_STORE);
    await new Promise<void>((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Failed to save voice history to IndexedDB", err);
  }
  return record;
}

export async function getVoiceHistory(): Promise<VoiceHistoryItem[]> {
  if (!isIndexedDBSupported()) {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_VOICE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  try {
    const db = await openDB();
    const tx = db.transaction(VOICE_HISTORY_STORE, "readonly");
    const store = tx.objectStore(VOICE_HISTORY_STORE);
    const list = await new Promise<VoiceHistoryItem[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    console.warn("Failed to get voice history", err);
    return [];
  }
}

export async function clearVoiceHistory(): Promise<void> {
  if (!isIndexedDBSupported()) {
    localStorage.removeItem(LOCAL_STORAGE_VOICE_KEY);
    return;
  }

  try {
    const db = await openDB();
    const tx = db.transaction(VOICE_HISTORY_STORE, "readwrite");
    const store = tx.objectStore(VOICE_HISTORY_STORE);
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Failed to clear voice history", err);
  }
}

// ================== RSS FEEDS ==================
export async function saveRSSFeed(feed: RSSFeed): Promise<void> {
  if (!isIndexedDBSupported()) {
    try {
      const current = localStorage.getItem(LOCAL_STORAGE_RSS_KEY);
      const list = current ? JSON.parse(current) : [];
      const idx = list.findIndex((f: any) => f.id === feed.id || f.url === feed.url);
      if (idx > -1) list[idx] = feed;
      else list.push(feed);
      localStorage.setItem(LOCAL_STORAGE_RSS_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn("Failed to save RSS feed to localStorage", err);
    }
    return;
  }

  try {
    const db = await openDB();

    // Để loại bỏ triệt để khả năng ConstraintError do chỉ mục url_idx cũ (unique: true) còn kẹt trên trình duyệt của máy khách,
    // ta chủ động kiểm tra nếu có feed nào khác có cùng URL nhưng ID khác, ta sẽ xóa nó đi trước khi lưu mới.
    const txRead = db.transaction(RSS_FEEDS_STORE, "readonly");
    const storeRead = txRead.objectStore(RSS_FEEDS_STORE);
    const existingFeeds = await new Promise<RSSFeed[]>((resolve) => {
      const req = storeRead.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    const duplicate = existingFeeds.find(f => f.url === feed.url && f.id !== feed.id);
    if (duplicate) {
      console.warn(`[IndexedDB Sync] Found duplicate RSS URL: ${feed.url}. Deleting legacy duplicate ${duplicate.id} first to prevent ConstraintError.`);
      const txDelete = db.transaction(RSS_FEEDS_STORE, "readwrite");
      const storeDelete = txDelete.objectStore(RSS_FEEDS_STORE);
      await new Promise<void>((resolve) => {
        const req = storeDelete.delete(duplicate.id);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    }

    const tx = db.transaction(RSS_FEEDS_STORE, "readwrite");
    const store = tx.objectStore(RSS_FEEDS_STORE);
    await new Promise<void>((resolve, reject) => {
      const request = store.put(feed);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Failed to save RSS feed to IndexedDB, falling back to localStorage", err);
    try {
      const current = localStorage.getItem(LOCAL_STORAGE_RSS_KEY);
      const list = current ? JSON.parse(current) : [];
      const idx = list.findIndex((f: any) => f.id === feed.id || f.url === feed.url);
      if (idx > -1) list[idx] = feed;
      else list.push(feed);
      localStorage.setItem(LOCAL_STORAGE_RSS_KEY, JSON.stringify(list));
    } catch (fallbackErr) {
      console.error("Critical fallback save RSS failed", fallbackErr);
    }
  }
}

export async function getRSSFeeds(): Promise<RSSFeed[]> {
  if (!isIndexedDBSupported()) {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_RSS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  try {
    const db = await openDB();
    const tx = db.transaction(RSS_FEEDS_STORE, "readonly");
    const store = tx.objectStore(RSS_FEEDS_STORE);
    const list = await new Promise<RSSFeed[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    return list;
  } catch (err) {
    console.warn("Failed to get RSS feeds", err);
    return [];
  }
}

export async function deleteRSSFeed(id: string): Promise<void> {
  if (!isIndexedDBSupported()) {
    try {
      const current = localStorage.getItem(LOCAL_STORAGE_RSS_KEY);
      if (current) {
        const list = JSON.parse(current);
        const filtered = list.filter((f: any) => f.id !== id);
        localStorage.setItem(LOCAL_STORAGE_RSS_KEY, JSON.stringify(filtered));
      }
    } catch (err) {
      console.warn("Failed to delete RSS feed from localStorage", err);
    }
    return;
  }

  try {
    const db = await openDB();
    const tx = db.transaction(RSS_FEEDS_STORE, "readwrite");
    const store = tx.objectStore(RSS_FEEDS_STORE);
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("Failed to delete RSS feed from IndexedDB", err);
  }
}

// ================== TĂNG LƯỢT THÍCH ==================
export async function incrementBriefingLikes(id: string): Promise<number> {
  if (!isIndexedDBSupported()) {
    for (const key of [LOCAL_STORAGE_FALLBACK_KEY_VI, LOCAL_STORAGE_FALLBACK_KEY_EN]) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const list = JSON.parse(stored);
        const idx = list.findIndex((b: any) => b.id === id);
        if (idx > -1) {
          list[idx].likeCount = (list[idx].likeCount || 0) + 1;
          localStorage.setItem(key, JSON.stringify(list));
          return list[idx].likeCount;
        }
      }
    }
    return 1;
  }

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const record = await new Promise<any>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (record) {
      record.likeCount = (record.likeCount || 0) + 1;
      await new Promise<void>((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      return record.likeCount;
    }
    return 0;
  } catch (err) {
    console.warn("Failed to increment likeCount", err);
    return 0;
  }
}

// ================== TĂNG LƯỢT CHIA SẺ ==================
export async function incrementBriefingShares(id: string): Promise<number> {
  if (!isIndexedDBSupported()) {
    for (const key of [LOCAL_STORAGE_FALLBACK_KEY_VI, LOCAL_STORAGE_FALLBACK_KEY_EN]) {
      const stored = localStorage.getItem(key);
      if (stored) {
        const list = JSON.parse(stored);
        const idx = list.findIndex((b: any) => b.id === id);
        if (idx > -1) {
          list[idx].shareCount = (list[idx].shareCount || 0) + 1;
          localStorage.setItem(key, JSON.stringify(list));
          return list[idx].shareCount;
        }
      }
    }
    return 1;
  }

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const record = await new Promise<any>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (record) {
      record.shareCount = (record.shareCount || 0) + 1;
      await new Promise<void>((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      return record.shareCount;
    }
    return 0;
  } catch (err) {
    console.warn("Failed to increment shareCount", err);
    return 0;
  }
}