import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseClientAsync } from "../services/supabaseClient";
import { performFullSyncAsync, processSyncQueueAsync, isOnline } from "../services/syncService";
import { User } from "@supabase/supabase-js";

export type SyncStatus = "synced" | "syncing" | "offline" | "error" | "unauthenticated";

export function useSync() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("unauthenticated");
  const [isOnlineState, setIsOnlineState] = useState(isOnline());

  // Use a ref to prevent concurrent/overlapping executions of the full sync process
  const syncInProgressRef = useRef(false);

  const safePerformSync = useCallback(async () => {
    if (syncInProgressRef.current) {
      console.log("[useSync] Sync already in progress. Skipping duplicate/concurrent execution.");
      return;
    }

    if (!isOnline()) {
      setSyncStatus("offline");
      return;
    }

    // Nếu đang trong quá trình tạo/tổng hợp bản tin phát thanh, hoãn đồng bộ để tránh tốn băng thông & giật lag UI
    if (typeof window !== "undefined" && (window as any).isCommuteCastGeneratingBriefing) {
      console.log("[useSync] Audio generation is in progress. Deferring sync to prevent performance interference.");
      return;
    }

    try {
      syncInProgressRef.current = true;
      setSyncStatus("syncing");
      console.log("[useSync] Starting full cloud-local data sync...");
      const ok = await performFullSyncAsync();
      setSyncStatus(ok ? "synced" : "error");
    } catch (err) {
      console.error("[useSync] Sync process failed:", err);
      setSyncStatus("error");
    } finally {
      syncInProgressRef.current = false;
    }
  }, []);

  // Check current session & load user
  const checkSession = useCallback(async () => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) {
      setUser(null);
      setSyncStatus("unauthenticated");
      setLoading(false);
      return;
    }

    try {
      if (typeof window !== "undefined" && window.location.hash.includes("access_token=")) {
        console.log("[useSync] Found OAuth token fragment in hash. Explicitly parsing with getSession...");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await safePerformSync();
      } else {
        setUser(null);
        setSyncStatus("unauthenticated");
      }
    } catch (err) {
      console.error("[useSync] Failed to check auth session:", err);
      setSyncStatus("error");
    } finally {
      setLoading(false);
    }
  }, [safePerformSync]);

  // Trigger manual sync
  const triggerSync = useCallback(async () => {
    if (!isOnline()) {
      setSyncStatus("offline");
      return;
    }

    const supabase = await getSupabaseClientAsync();
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

  // Listen to Auth state changes and connection updates
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

      // 1. Instantly subscribe to onAuthStateChange first, BEFORE checkSession() resolves,
      // so we don't miss the initial SIGNED_IN or INITIAL_SESSION events triggered by hash URL fragment parsing.
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log(`[useSync] Auth event triggered: ${event}`, session?.user?.email);
        
        if (session?.user) {
          setUser(session.user);
          await safePerformSync();
        } else {
          setUser(null);
          setSyncStatus("unauthenticated");
        }
        setLoading(false);
      });

      unsubscribe = () => subscription.unsubscribe();

      // 2. Perform an immediate check session in parallel/concurrently to pull initial session if subscription takes time
      await checkSession();
    }

    setupListeners();

    // Connection listeners
    const handleOnline = async () => {
      setIsOnlineState(true);
      console.log("[useSync] Browser is online. Auto-flushing sync queue...");
      const supabase = await getSupabaseClientAsync();
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setSyncStatus("syncing");
          const ok = await processSyncQueueAsync();
          if (ok) {
            await safePerformSync();
          } else {
            setSyncStatus("error");
          }
        }
      }
    };

    const handleOffline = () => {
      setIsOnlineState(false);
      console.log("[useSync] Browser went offline.");
      setSyncStatus(prev => (prev === "unauthenticated" ? "unauthenticated" : "offline"));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [checkSession, safePerformSync]);

  return {
    user,
    loading,
    syncStatus,
    isOnline: isOnlineState,
    triggerSync,
    checkSession
  };
}
