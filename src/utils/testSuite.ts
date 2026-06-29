import { calculateDecayedScore, getTopPreferences, calculatePreferences, recalculateTopicPreference } from "../services/preferenceService";
import { recordInteraction } from "../services/interactionService";
import { openDB } from "../services/storageService";
import { InteractionHistory, UserPreference } from "../types/preference";

export interface TestResult {
  name: string;
  category: "unit" | "integration";
  passed: boolean;
  error?: string;
  durationMs: number;
}

/**
 * Runs the complete diagnostic test suite for the Recommendation Engine.
 * This runs fully in the client against mock/live IndexedDB transactions
 * without affecting production data.
 */
export async function runRecommendationTestSuite(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const runTest = async (
    name: string,
    category: "unit" | "integration",
    fn: () => Promise<void> | void
  ) => {
    const start = performance.now();
    try {
      await fn();
      results.push({
        name,
        category,
        passed: true,
        durationMs: Math.round(performance.now() - start),
      });
    } catch (err: any) {
      results.push({
        name,
        category,
        passed: false,
        error: err.message || String(err),
        durationMs: Math.round(performance.now() - start),
      });
    }
  };

  // ==================== UNIT TESTS ====================

  await runTest("Unit - Time Decay Math Precision", "unit", () => {
    const now = new Date();
    
    // Exact match for 0 days ago (should have base score)
    const scoreNow = calculateDecayedScore("view", now.toISOString(), now);
    if (Math.abs(scoreNow - 1.0) > 0.0001) {
      throw new Error(`Expected score close to 1.0 for view now, got ${scoreNow}`);
    }

    // 1 day ago decay factor: base * (0.95 ^ 1) = 0.95
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const scoreYesterday = calculateDecayedScore("view", yesterday.toISOString(), now);
    if (Math.abs(scoreYesterday - 0.95) > 0.0001) {
      throw new Error(`Expected yesterday view score to decay to 0.95, got ${scoreYesterday}`);
    }

    // 10 days ago: share (base 5) * (0.95 ^ 10) = 5 * 0.598736939 = ~2.9937
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const scoreTenDaysAgo = calculateDecayedScore("share", tenDaysAgo.toISOString(), now);
    const expected = 5 * Math.pow(0.95, 10);
    if (Math.abs(scoreTenDaysAgo - expected) > 0.001) {
      throw new Error(`Expected 10-day decayed score to be ~${expected}, got ${scoreTenDaysAgo}`);
    }
  });

  await runTest("Unit - Scoring Map Mapping", "unit", () => {
    const now = new Date();
    // Test that each action has correct base weights (view=1, click=2, like=3, share=5)
    const v = calculateDecayedScore("view", now.toISOString(), now);
    const c = calculateDecayedScore("click", now.toISOString(), now);
    const l = calculateDecayedScore("like", now.toISOString(), now);
    const s = calculateDecayedScore("share", now.toISOString(), now);

    if (v !== 1 || c !== 2 || l !== 3 || s !== 5) {
      throw new Error(`Incorrect scoring map weights. View: ${v}, Click: ${c}, Like: ${l}, Share: ${s}`);
    }
  });

  await runTest("Unit - 30 Days Out-of-Bounds Filtering", "unit", () => {
    const now = new Date();
    // 31 days ago must decay to 0 (ignored)
    const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
    const score = calculateDecayedScore("like", thirtyOneDaysAgo.toISOString(), now);
    if (score !== 0) {
      throw new Error(`Expected interactions older than 30 days to return score 0, got ${score}`);
    }
  });

  // ==================== INTEGRATION TESTS ====================

  await runTest("Integration - IndexedDB Read/Write & Incremental Updates", "integration", async () => {
    const testTopic = `Test-Topic-${Date.now()}`;
    
    // 1. Record a click interaction
    await recordInteraction(testTopic, "click");

    // 2. Open DB and query the stored interaction
    const db = await openDB();
    const tx = db.transaction("interactionHistory", "readonly");
    const store = tx.objectStore("interactionHistory");
    const index = store.index("topic");
    const getRequest = index.getAll(testTopic);

    const interactions: InteractionHistory[] = await new Promise((resolve, reject) => {
      getRequest.onsuccess = () => resolve(getRequest.result || []);
      getRequest.onerror = () => reject(getRequest.error);
    });

    if (interactions.length !== 1) {
      throw new Error(`Expected exactly 1 interaction saved in history for ${testTopic}, found ${interactions.length}`);
    }

    if (interactions[0].action !== "click" || interactions[0].topic !== testTopic) {
      throw new Error("Stored interaction fields do not match written values");
    }

    // 3. Verify user preference for this topic was incrementally created/updated
    const prefTx = db.transaction("userPreferences", "readonly");
    const prefStore = prefTx.objectStore("userPreferences");
    const prefRequest = prefStore.get(testTopic);

    const preference: UserPreference | undefined = await new Promise((resolve, reject) => {
      prefRequest.onsuccess = () => resolve(prefRequest.result);
      prefRequest.onerror = () => reject(prefRequest.error);
    });

    if (!preference) {
      throw new Error(`Expected user preference to be calculated incrementally for topic: ${testTopic}`);
    }

    // Expected score for view click now = 2
    if (Math.abs(preference.score - 2.0) > 0.05) {
      throw new Error(`Expected user preference score to be ~2.0, found ${preference.score}`);
    }

    // Clean up test data
    const cleanupTx = db.transaction(["interactionHistory", "userPreferences"], "readwrite");
    cleanupTx.objectStore("userPreferences").delete(testTopic);
    
    // Clean up history records using cursor/primary keys
    const historyStoreRW = cleanupTx.objectStore("interactionHistory");
    const cleanupIndex = historyStoreRW.index("topic");
    const listReq = cleanupIndex.getAll(testTopic);
    listReq.onsuccess = () => {
      listReq.result.forEach((item: any) => {
        historyStoreRW.delete(item.id);
      });
    };
  });

  await runTest("Integration - Preference Matrix Full Rebuild", "integration", async () => {
    const testTopicA = `Topic-A-${Date.now()}`;
    const testTopicB = `Topic-B-${Date.now()}`;

    // Record mock events
    await recordInteraction(testTopicA, "like"); // score ~3
    await recordInteraction(testTopicB, "share"); // score ~5

    // Run full preference calculation
    const controller = new AbortController();
    await calculatePreferences(controller.signal);

    // Retrieve top preferences
    const topPrefs = await getTopPreferences(10);
    const hasA = topPrefs.some((p) => p.topic === testTopicA);
    const hasB = topPrefs.some((p) => p.topic === testTopicB);

    if (!hasA || !hasB) {
      throw new Error("Full rebuild calculation missed recorded test topics");
    }

    // Sort descending validation: B (score 5) must rank higher than A (score 3)
    const rankA = topPrefs.findIndex((p) => p.topic === testTopicA);
    const rankB = topPrefs.findIndex((p) => p.topic === testTopicB);

    if (rankB > rankA) {
      throw new Error("Preferences sorting descending is broken: share (5) did not rank higher than like (3)");
    }

    // Clean up database
    const db = await openDB();
    const cleanupTx = db.transaction(["interactionHistory", "userPreferences"], "readwrite");
    const prefStore = cleanupTx.objectStore("userPreferences");
    prefStore.delete(testTopicA);
    prefStore.delete(testTopicB);

    const histStore = cleanupTx.objectStore("interactionHistory");
    const idx = histStore.index("topic");
    
    const listA = idx.getAll(testTopicA);
    listA.onsuccess = () => listA.result.forEach((item) => histStore.delete(item.id));
    
    const listB = idx.getAll(testTopicB);
    listB.onsuccess = () => listB.result.forEach((item) => histStore.delete(item.id));
  });

  return results;
}
