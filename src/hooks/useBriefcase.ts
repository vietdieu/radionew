import { useState, useEffect, useCallback } from "react";
import { SavedSummary } from "../types";
import {
  getAllBriefings,
  getBriefing as fetchBriefing,
  clearAll as purgeAll,
  migrateLegacyLocalStorageData,
  getStorageEstimate,
  isIndexedDBSupported
} from "../services/storageService";
import {
  syncSaveBriefingAsync,
  syncDeleteBriefingAsync
} from "../services/syncService";

export function useBriefcase() {
  const [briefings, setBriefings] = useState<SavedSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageUsage, setStorageUsage] = useState<{ usedMB: number; totalMB?: number }>({ usedMB: 0 });
  const [isDBSupported, setIsDBSupported] = useState(true);

  // Load briefings list (default metadata only for maximum speed)
  const refreshBriefings = useCallback(async (includeAudio = false) => {
    setLoading(true);
    try {
      const data = await getAllBriefings(includeAudio);
      setBriefings(data);
      const estimate = await getStorageEstimate();
      setStorageUsage(estimate);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load briefings:", err);
      setError("Failed to load briefings.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Run migration and initial load on mount
  useEffect(() => {
    setIsDBSupported(isIndexedDBSupported());
    const initStorage = async () => {
      try {
        // Run migration of legacy data
        const migratedCount = await migrateLegacyLocalStorageData();
        if (migratedCount > 0) {
          console.log(`Successfully migrated ${migratedCount} old items from localStorage to IndexedDB.`);
        }
      } catch (err) {
        console.warn("Migration failed during hook init:", err);
      } finally {
        // Load metadata only for high performance list rendering
        await refreshBriefings(false);
      }
    };
    initStorage();
  }, [refreshBriefings]);

  const saveNewBriefing = useCallback(async (item: SavedSummary) => {
    try {
      await syncSaveBriefingAsync(item);
      // Reload metadata list
      await refreshBriefings(false);
      return true;
    } catch (err: any) {
      console.error("Save briefing failed:", err);
      if (err.message === "STORAGE_QUOTA_EXCEEDED") {
        setError("Storage quota exceeded. Please delete some old briefings.");
        alert("⚠️ Bộ nhớ lưu trữ đầy (Storage Quota Exceeded)! Vui lòng xóa bớt một số bản tin cũ để giải phóng bộ nhớ và tiếp tục lưu trữ.");
      } else {
        setError("Failed to save briefing.");
      }
      return false;
    }
  }, [refreshBriefings]);

  const deleteOneBriefing = useCallback(async (id: string) => {
    try {
      await syncDeleteBriefingAsync(id);
      await refreshBriefings(false);
      return true;
    } catch (err) {
      console.error(`Failed to delete briefing with ID: ${id}`, err);
      setError("Failed to delete briefing.");
      return false;
    }
  }, [refreshBriefings]);

  const clearAllBriefings = useCallback(async () => {
    try {
      await purgeAll();
      await refreshBriefings(false);
      return true;
    } catch (err) {
      console.error("Failed to clear briefings store:", err);
      setError("Failed to clear briefings database.");
      return false;
    }
  }, [refreshBriefings]);

  const getFullBriefing = useCallback(async (id: string): Promise<SavedSummary | null> => {
    try {
      return await fetchBriefing(id);
    } catch (err) {
      console.error(`Failed to load full briefing with ID: ${id}`, err);
      setError("Failed to load full briefing.");
      return null;
    }
  }, []);

  return {
    briefings,
    loading,
    error,
    storageUsage,
    isDBSupported,
    saveNewBriefing,
    deleteOneBriefing,
    clearAllBriefings,
    getFullBriefing,
    refreshBriefings
  };
}
export default useBriefcase;
