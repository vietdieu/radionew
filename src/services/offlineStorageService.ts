import { SavedSummary, SummaryPreferences, SummaryPayload } from "../types";
import { openDB } from "./storageService";

const STORE_NAME = "audios";

export function isIndexedDBSupported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

/**
 * Lưu toàn bộ dữ liệu chữ và mảng base64 âm thanh vào IndexedDB
 */
export async function saveEpisodeToOffline(
  id: string,
  preferences: SummaryPreferences,
  payload: SummaryPayload,
  audioChunks: string[]
): Promise<void> {
  if (!isIndexedDBSupported()) {
    console.warn("IndexedDB not supported, cannot save offline.");
    return;
  }

  const db = await openDB();
  const timestamp = new Date().toLocaleString();
  
  const savedItem: SavedSummary = {
    id,
    timestamp,
    preferences,
    payload,
    audioChunks
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(savedItem);

    request.onsuccess = () => {
      console.log(`Episode ${id} saved successfully to offline IndexedDB.`);
      resolve();
    };

    request.onerror = () => {
      reject(request.error || new Error(`Failed to save episode ${id} offline`));
    };
  });
}

/**
 * Lấy dữ liệu ra để phát lại
 */
export async function getEpisodeFromOffline(id: string): Promise<SavedSummary | null> {
  if (!isIndexedDBSupported()) {
    return null;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = (event: any) => {
      resolve(event.target.result || null);
    };

    request.onerror = () => {
      reject(request.error || new Error(`Failed to get episode ${id} offline`));
    };
  });
}

/**
 * Tự động xóa các bản tin cũ hơn 7 ngày để giải phóng bộ nhớ máy của người dùng
 */
export async function deleteOldEpisodes(): Promise<number> {
  if (!isIndexedDBSupported()) {
    return 0;
  }

  const db = await openDB();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();

    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        const item = cursor.value;
        const itemTime = new Date(item.timestamp).getTime();
        
        // Kiểm tra nếu thời gian của item hợp lệ và cũ hơn 7 ngày
        if (!isNaN(itemTime) && itemTime < sevenDaysAgo) {
          console.log(`Deleting old offline episode: ${item.id} from ${item.timestamp}`);
          cursor.delete();
          deletedCount++;
        }
        cursor.continue();
      } else {
        resolve(deletedCount);
      }
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to clear old offline episodes"));
    };
  });
}
