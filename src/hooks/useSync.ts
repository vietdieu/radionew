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

export type SyncStatus = "synced" | "syncing" | "offline" | "error" | "unauthenticated";

export function useSync() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("unauthenticated");
  const [isOnlineState, setIsOnlineState] = useState(isOnline());
  const [isAborting, setIsAborting] = useState(false);
  const [queueLength, setQueueLength] = useState(0);

  // Ref để chặn đồng bộ song song
  const syncInProgressRef = useRef(false);
  // Ref quản lý timer debounce
  const debounceTimerRef = useRef<any>(null);

  // Cập nhật số lượng phần tử chờ đồng bộ
  const updateQueueLength = useCallback(async () => {
    try {
      const queue = await getSyncQueue();
      setQueueLength(queue.length);
    } catch (e) {
      setQueueLength(0);
    }
  }, []);

  // Hàm thực hiện đồng bộ an toàn
  const safePerformSync = useCallback(async () => {
    if (syncInProgressRef.current) {
      console.log("[useSync] Sync already in progress. Skipping concurrent run.");
      return;
    }

    if (!isOnline()) {
      setSyncStatus("offline");
      return;
    }

    if (typeof window !== "undefined" && (window as any).isCommuteCastGeneratingBriefing) {
      console.log("[useSync] Audio generation is active. Deferring sync.");
      return;
    }

    try {
      syncInProgressRef.current = true;
      setSyncStatus("syncing");
      setIsAborting(false);
      
      console.log("[useSync] Starting full cloud-local batch synchronization...");
      const ok = await performFullSyncAsync();
      
      if (ok) {
        setSyncStatus("synced");
      } else {
        // Nếu bị hủy, giữ trạng thái synced hoặc offline tùy mạng
        setSyncStatus(isOnline() ? "synced" : "offline");
      }
    } catch (err) {
      console.error("[useSync] Sync failed:", err);
      setSyncStatus("error");
    } finally {
      syncInProgressRef.current = false;
      setIsAborting(false);
      await updateQueueLength();
    }
  }, [updateQueueLength]);

  // Thiết lập debounce 3-5 giây (chọn 4 giây làm mốc tối ưu)
  const triggerDebouncedSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Cập nhật độ dài hàng đợi hiển thị tức thì trên UI trước khi chạy thực tế
    updateQueueLength();

    debounceTimerRef.current = setTimeout(async () => {
      console.log("[useSync] Debounce timer fired. Executing batch synchronization...");
      
      const supabase = await getSupabaseClientAsync();
      if (!supabase) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await safePerformSync();
      }
    }, 4000); // Trì hoãn 4 giây
  }, [safePerformSync, updateQueueLength]);

  // Hàm hủy đồng bộ thủ công
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

  // Kiểm tra phiên đăng nhập ban đầu
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
    } catch (err) {
      console.error("[useSync] Auth check error:", err);
      setSyncStatus("error");
    } finally {
      setLoading(false);
      await updateQueueLength();
    }
  }, [safePerformSync, updateQueueLength]);

  // Kích hoạt đồng bộ thủ công ngay lập tức
  const triggerSync = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

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

  // Lắng nghe các sự kiện và trạng thái mạng
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
        console.log(`[useSync] Auth event: ${event}`, session?.user?.email);
        
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

    // Sự kiện khi mạng online trở lại
    const handleOnline = async () => {
      setIsOnlineState(true);
      console.log("[useSync] Browser went ONLINE. Processing pending queue...");
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
            await updateQueueLength();
          }
        }
      }
    };

    // Sự kiện khi mạng offline
    const handleOffline = () => {
      setIsOnlineState(false);
      console.log("[useSync] Browser went OFFLINE.");
      setSyncStatus(prev => (prev === "unauthenticated" ? "unauthenticated" : "offline"));
    };

    // Sự kiện khi có thay đổi trong hàng đợi đồng bộ cục bộ
    const handleQueueUpdated = () => {
      console.log("[useSync] Sync queue updated. Debouncing cloud synchronization...");
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
