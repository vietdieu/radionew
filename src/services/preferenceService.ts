import { openDB } from "./storageService";
import { InteractionHistory, UserPreference } from "../types/preference";

const SCORE_MAP: Record<string, number> = {
  view: 1,
  click: 2,
  like: 3,
  share: 5,
};

const DECAY_RATE = 0.95;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Calculates the decayed score for a single interaction.
 */
export function calculateDecayedScore(
  action: "view" | "click" | "like" | "share",
  createdAtStr: string,
  now: Date = new Date()
): number {
  const base = SCORE_MAP[action] || 0;
  const createdTime = new Date(createdAtStr).getTime();
  if (isNaN(createdTime)) return 0;

  const diffMs = now.getTime() - createdTime;
  if (diffMs < 0 || diffMs > THIRTY_DAYS_MS) {
    return 0; // Ignore if in the future or older than 30 days
  }

  const daysAgo = diffMs / (1000 * 60 * 60 * 24);
  return base * Math.pow(DECAY_RATE, daysAgo);
}

/**
 * Recalculates the score and last interaction time for a single topic
 * based on its 30-day interaction history, then persists it to userPreferences.
 */
export async function recalculateTopicPreference(topic: string): Promise<void> {
  if (!topic) return;

  const db = await openDB();
  const tx = db.transaction(["interactionHistory", "userPreferences"], "readwrite");
  const historyStore = tx.objectStore("interactionHistory");
  const prefStore = tx.objectStore("userPreferences");

  const topicIndex = historyStore.index("topic");
  const request = topicIndex.getAll(topic);

  return new Promise<void>((resolve, reject) => {
    request.onsuccess = () => {
      const interactions: InteractionHistory[] = request.result || [];
      const now = new Date();
      const thirtyDaysAgo = now.getTime() - THIRTY_DAYS_MS;

      let scoreSum = 0;
      let maxInteractedMs = 0;

      // Filter and compute the decayed scores
      for (const inter of interactions) {
        const itemTime = new Date(inter.created_at).getTime();
        if (isNaN(itemTime) || itemTime < thirtyDaysAgo) {
          continue;
        }
        const decayed = calculateDecayedScore(inter.action, inter.created_at, now);
        scoreSum += decayed;
        if (itemTime > maxInteractedMs) {
          maxInteractedMs = itemTime;
        }
      }

      if (scoreSum > 0) {
        const pref: UserPreference = {
          topic,
          score: scoreSum,
          lastInteractedAt: maxInteractedMs > 0 ? new Date(maxInteractedMs).toISOString() : now.toISOString(),
        };
        prefStore.put(pref);
      } else {
        // Delete preference if score drops to zero or no active interactions
        prefStore.delete(topic);
      }
      resolve();
    };

    request.onerror = () => {
      console.error(`[recalculateTopicPreference] Failed for topic: ${topic}`, request.error);
      reject(request.error);
    };
  });
}

/**
 * Rebuilds the userPreferences database in background chunks.
 * Uses cursor batching to keep the main thread fluid and responsive.
 */
export async function calculatePreferences(signal?: AbortSignal): Promise<void> {
  const db = await openDB();
  const now = new Date();
  const thirtyDaysAgo = now.getTime() - THIRTY_DAYS_MS;

  // 1. Fetch interaction histories in the last 30 days using cursor batching to keep memory and CPU low
  const historyTx = db.transaction("interactionHistory", "readonly");
  const historyStore = historyTx.objectStore("interactionHistory");
  const dateIndex = historyStore.index("created_at");

  // Query records from 30 days ago to now
  const range = IDBKeyRange.lowerBound(new Date(thirtyDaysAgo).toISOString());
  const request = dateIndex.openCursor(range);

  const topicScores: Record<string, { total: number; lastMs: number }> = {};

  await new Promise<void>((resolve, reject) => {
    request.onsuccess = (e: any) => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }

      const cursor = e.target.result;
      if (cursor) {
        const item = cursor.value as InteractionHistory;
        const score = calculateDecayedScore(item.action, item.created_at, now);

        if (score > 0) {
          if (!topicScores[item.topic]) {
            topicScores[item.topic] = { total: 0, lastMs: 0 };
          }
          topicScores[item.topic].total += score;

          const itemMs = new Date(item.created_at).getTime();
          if (itemMs > topicScores[item.topic].lastMs) {
            topicScores[item.topic].lastMs = itemMs;
          }
        }

        // Keep moving cursor
        cursor.continue();
      } else {
        resolve();
      }
    };

    request.onerror = () => reject(request.error);
  });

  if (signal?.aborted) return;

  // 2. Perform background batch saving of preferences into IndexedDB
  // Use requestIdleCallback or setTimeout chunking to avoid locking the UI
  const prefTx = db.transaction(["userPreferences", "appMetadata"], "readwrite");
  const prefStore = prefTx.objectStore("userPreferences");
  const metaStore = prefTx.objectStore("appMetadata");

  // Clear existing first
  prefStore.clear();

  const topics = Object.keys(topicScores);
  const CHUNK_SIZE = 10;
  
  const saveChunk = async (index: number) => {
    if (signal?.aborted) return;
    if (index >= topics.length) {
      // Done. Update last calculation timestamp
      metaStore.put({ key: "lastPreferenceCalculation", value: now.toISOString() });
      console.log("[calculatePreferences] Rebuild completed successfully.");
      return;
    }

    const end = Math.min(index + CHUNK_SIZE, topics.length);
    for (let i = index; i < end; i++) {
      const topic = topics[i];
      const data = topicScores[topic];
      const pref: UserPreference = {
        topic,
        score: data.total,
        lastInteractedAt: new Date(data.lastMs).toISOString(),
      };
      prefStore.put(pref);
    }

    // Yield control to UI thread
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(() => saveChunk(end));
    } else {
      setTimeout(() => saveChunk(end), 0);
    }
  };

  await saveChunk(0);
}

/**
 * Triggers a full rebuild if cache has expired or force is true.
 */
export async function rebuildPreferencesIfNeeded(force = false): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("appMetadata", "readonly");
  const metaStore = tx.objectStore("appMetadata");

  const lastCalcRequest = metaStore.get("lastPreferenceCalculation");

  return new Promise<void>((resolve) => {
    lastCalcRequest.onsuccess = async () => {
      const result = lastCalcRequest.result;
      const lastCalcStr = result ? result.value : null;

      const now = new Date().getTime();
      const shouldRebuild =
        force ||
        !lastCalcStr ||
        now - new Date(lastCalcStr).getTime() > CACHE_EXPIRY_MS;

      if (shouldRebuild) {
        console.log("[rebuildPreferencesIfNeeded] Cache expired or first launch. Rebuilding preferences...");
        try {
          await calculatePreferences();
        } catch (err) {
          console.error("[rebuildPreferencesIfNeeded] Failed to calculate:", err);
        }
      } else {
        console.log("[rebuildPreferencesIfNeeded] Preferences cache is fresh.");
      }
      resolve();
    };

    lastCalcRequest.onerror = () => {
      console.warn("[rebuildPreferencesIfNeeded] Error retrieving calculation timestamp. Defaulting to rebuild.");
      calculatePreferences().then(resolve).catch(() => resolve());
    };
  });
}

/**
 * Fetches top personalized topics sorted by score descending.
 */
export async function getTopPreferences(limit = 5): Promise<UserPreference[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("userPreferences", "readonly");
    const store = tx.objectStore("userPreferences");
    const scoreIndex = store.index("score");
    const request = scoreIndex.openCursor(null, "prev"); // Descending order

    return new Promise<UserPreference[]>((resolve, reject) => {
      const results: UserPreference[] = [];
      request.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[getTopPreferences] Error fetching preferences:", error);
    return [];
  }
}

/**
 * Schedules preference calculation to run in the background without blocking the initial render.
 */
export function schedulePreferenceCalculation(): void {
  if (typeof window !== "undefined") {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => {
        rebuildPreferencesIfNeeded().catch((err) =>
          console.error("[schedulePreferenceCalculation] Background rebuild failed:", err)
        );
      });
    } else {
      setTimeout(() => {
        rebuildPreferencesIfNeeded().catch((err) =>
          console.error("[schedulePreferenceCalculation] Background rebuild failed:", err)
        );
      }, 2000);
    }
  }
}

