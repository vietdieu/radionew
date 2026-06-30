import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseClientAsync } from "../services/supabaseClient";
import { 
  performFullSyncAsync, 
  processSyncQueueAsync, 
  isOnline,
  abortSync as abortSyncService,
  getSyncQueue
} from "../services/syncService";
import { User } from "@supabase/supabase-js";
import { cloudSyncStatus, CloudSyncState } from "../services/cloudSyncStatus";
import { logger } from "../utils/logger";

export type SyncStatus = "synced" | "syncing" | "offline" | "error" | "unauthenticated";

export function useSync() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("unauthenticated");
  const [cloudStatus, setCloudStatus] = useState<CloudSyncState>(cloudSyncStatus.getState());
  const [isOnlineState, setIsOnlineState] = useState(isOnline());
  const [isAborting, setIsAborting] = useState(false);
  const [queueLength, setQueueLength] = useState(0);

  // Ref to block parallel sync runs
  const syncInProgressRef = useRef(false);
  // Ref for debounce timer
  const debounceTimerRef = useRef<any>(null);

  // Subscribe to central authoritative cloud sync status
  useEffect(() => {
    const unsubscribe = cloudSyncStatus.subscribe((state) => {
      setCloudStatus(state);
    });
    return unsubscribe;
  }, []);

  // Update pending sync queue length
  const updateQueueLength = useCallback(async () => {
    try {
      const queue = await getSyncQueue();
      setQueueLength(queue.length);
    } catch (e) {
      setQueueLength(0);
    }
  }, []);

  // Safe synchronization runner
  const safePerformSync = useCallback(async () => {
    if (syncInProgressRef.current) {
      logger.info("[useSync] Sync already in progress. Skipping concurrent run.");
      return;
    }

    if (!isOnline()) {
      setSyncStatus("offline");
      return;
    }

    if (typeof window !== "undefined" && (window as any).isCommuteCastGeneratingBriefing) {
      logger.info("[useSync] Audio generation is active. Deferring sync.");
      return;
    }

    try {
      syncInProgressRef.current = true;
      setSyncStatus("syncing");
      setIsAborting(false);
      
      logger.info("[useSync] Starting full cloud-local batch synchronization...");
      const ok = await performFullSyncAsync();
      
      if (ok) {
        setSyncStatus("synced");
      } else {
        setSyncStatus(isOnline() ? "synced" : "offline");
      }
    } catch (err: any) {
      logger.error("[useSync] Sync failed:", err);
      setSyncStatus("error");
    } finally {
      syncInProgressRef.current = false;
      setIsAborting(false);
      await updateQueueLength();
    }
  }, [updateQueueLength]);

  // Debounced cloud synchronization
  const triggerDebouncedSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    updateQueueLength();

    debounceTimerRef.current = setTimeout(async () => {
      logger.info("[useSync] Debounce timer fired. Executing batch synchronization...");
      
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await safePerformSync();
      }
    }, 4000);
  }, [safePerformSync, updateQueueLength]);

  // Abort synchronization manually
  const handleAbortSync = useCallback(() => {
    if (syncStatus === "syncing") {
      const confirmed = window.confirm(
        "Bạn có chắc muốn hủy đồng bộ?\nDữ liệu sẽ không được cập nhật lên cloud."
      );
      if (confirmed) {
        setIsAborting(true);
        const aborted = abortSyncService();
        if (!aborted) {
          setIsAborting(false);
          alert("Không có tiến trình đồng bộ nào để hủy.");
        } else {
          setSyncStatus("synced");
          setIsAborting(false);
          updateQueueLength();
        }
      }
    } else {
      alert("Không có tiến trình đồng bộ nào đang chạy.");
    }
  }, [syncStatus, updateQueueLength]);

  // Check active session on startup
  const checkSession = useCallback(async () => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) {
      setUser(null);
      setSyncStatus("unauthenticated");
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await safePerformSync();
      } else {
        setUser(null);
        setSyncStatus("unauthenticated");
      }
    } catch (err: any) {
      logger.error("[useSync] Auth check error:", err);
      setSyncStatus("error");
    } finally {
      setLoading(false);
      await updateQueueLength();
    }
  }, [safePerformSync, updateQueueLength]);

  // Trigger immediate synchronization manually
  const triggerSync = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!isOnline()) {
      setSyncStatus("offline");
      return;
    }

    const supabase = await getSupabaseClientAsync(true); // Force connection and health check ping
    if (!supabase) {
      setSyncStatus("error");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      setSyncStatus("unauthenticated");
      return;
    }

    await safePerformSync();
  }, [safePerformSync]);

  // Network and event listeners configuration
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function setupListeners() {
      const supabase = await getSupabaseClientAsync();
      if (!supabase) {
        setUser(null);
        setSyncStatus("unauthenticated");
        setLoading(false);
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        logger.info(`[useSync] Auth event: ${event}`, session?.user?.email);
        
        if (session?.user) {
          setUser(session.user);
          await safePerformSync();
        } else {
          setUser(null);
          setSyncStatus("unauthenticated");
        }
        setLoading(false);
        await updateQueueLength();
      });

      unsubscribe = () => subscription.unsubscribe();
      await checkSession();
    }

    setupListeners();

    // Trigger on browser going online
    const handleOnline = async () => {
      setIsOnlineState(true);
      logger.info("[useSync] Browser went ONLINE. Verifying connection and processing queue...");
      
      const supabase = await getSupabaseClientAsync(true); // Force reconnect and health check ping
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setSyncStatus("syncing");
          const ok = await processSyncQueueAsync();
          if (ok) {
            await safePerformSync();
          } else {
            setSyncStatus("error");
            await updateQueueLength();
          }
        }
      }
    };

    // Trigger on browser going offline
    const handleOffline = () => {
      setIsOnlineState(false);
      logger.info("[useSync] Browser went OFFLINE.");
      setSyncStatus(prev => (prev === "unauthenticated" ? "unauthenticated" : "offline"));
    };

    // Trigger on queue update
    const handleQueueUpdated = () => {
      logger.info("[useSync] Sync queue updated. Debouncing cloud synchronization...");
      triggerDebouncedSync();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("commutecast-sync-queue-updated", handleQueueUpdated);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("commutecast-sync-queue-updated", handleQueueUpdated);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [checkSession, safePerformSync, triggerDebouncedSync, updateQueueLength]);

  return {
    user,
    loading,
    syncStatus,
    cloudStatus,
    isOnline: isOnlineState,
    triggerSync,
    checkSession,
    isAborting,
    abortSync: handleAbortSync,
    queueLength,
    updateQueueLength
  };
}
export default useSync;
