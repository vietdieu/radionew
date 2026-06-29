import { openDB } from "./storageService";
import { InteractionHistory } from "../types/preference";
import { recalculateTopicPreference } from "./preferenceService";

/**
 * Records a user interaction in IndexedDB and updates preference scores incrementally.
 * @param topic The topic associated with the interaction (must not be empty).
 * @param action The user interaction type ("view" | "click" | "like" | "share").
 * @param chapterId Optional chapter identifier for fine-grained interaction tracking.
 */
export async function recordInteraction(
  topic: string,
  action: "view" | "click" | "like" | "share",
  chapterId?: string
): Promise<void> {
  const normalizedTopic = (topic || "").trim();
  if (!normalizedTopic) return;

  try {
    const db = await openDB();
    const tx = db.transaction("interactionHistory", "readwrite");
    const store = tx.objectStore("interactionHistory");

    const id = `inter-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const interaction: InteractionHistory = {
      id,
      topic: normalizedTopic,
      action,
      created_at: new Date().toISOString(),
    };

    if (chapterId) {
      interaction.chapterId = chapterId;
    }

    return new Promise<void>((resolve, reject) => {
      const request = store.put(interaction);

      request.onsuccess = async () => {
        // Trigger incremental preference update for the affected topic only
        try {
          await recalculateTopicPreference(normalizedTopic);
          // Dispatch global event for reactive UI updates
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("commute-cast-preference-updated", {
              detail: { topic: normalizedTopic, action }
            }));
          }
          resolve();
        } catch (prefErr) {
          console.error(`[recordInteraction] Incremental preference recalculation failed for: ${normalizedTopic}`, prefErr);
          resolve(); // Resolve anyway to avoid blocking UI with recommendation calculation failures
        }
      };

      request.onerror = () => {
        console.error("[recordInteraction] Failed to save interaction:", request.error);
        reject(request.error);
      };
    });
  } catch (err) {
    console.error("[recordInteraction] IndexedDB transaction error:", err);
  }
}
