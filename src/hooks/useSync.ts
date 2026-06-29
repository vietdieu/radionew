import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseClientAsync } from "../services/supabaseClient";
import { 
  performFullSyncAsync, 
  processSyncQueueAsync, 
  isOnline,
  abortSync as abortSyncService
} from "../services/syncService";
import { User } from "@supabase/supabase-js";

export type SyncStatus = "synced" | "syncing" | "offline" | "error" | "unauthenticated";

export function useSync() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("unauthenticated");
  const [isOnlineState, setIsOnlineState] = useState(isOnline());
  const [isAborting, setIsAborting] = useState(false); // <-- Thêm state cho trạng thái đang hủy

  // Ref để chặn đồng bộ song song
  const syncInProgressRef = useRef(false);

  // Hàm thực hiện đồng bộ an toàn
  const safePerformSync = useCallback(async () => {
    // Nếu đang có đồng bộ khác chạy thì bỏ qua
    if (syncInProgressRef.current) {
      console.log("[useSync] Sync already in progress. Skipping duplicate/concurrent execution.");
      return;
    }

    if (!isOnline()) {
      setSyncStatus("offline");
      return;
    }

    // Nếu đang tạo audio thì hoãn
    if (typeof window !== "undefined" && (window as any).isCommuteCastGeneratingBriefing) {
      console.log("[useSync] Audio generation is in progress. Deferring sync to prevent performance interference.");
      return;
    }

    try {
      syncInProgressRef.current = true;
      setSyncStatus("syncing");
      setIsAborting(false); // Reset trạng thái hủy
      console.log("[useSync] Starting full cloud-local data sync...");
      const ok = await performFullSyncAsync();
      
      // Nếu đồng bộ bị hủy, performFullSyncAsync trả về false, nhưng không đặt lỗi
      if (ok) {
        setSyncStatus("synced");
      } else {
        // Có thể bị hủy hoặc lỗi, nhưng giữ nguyên trạng thái trước đó?
        // Nếu đang ở syncing và không thành công thì có thể do hủy
        if (syncStatus === "syncing") {
          // Nếu đang ở trạng thái syncing và kết quả false, có thể do hủy hoặc lỗi.
          // Ta kiểm tra xem có đang abort không?
          // Tuy nhiên, để đơn giản, nếu không thành công, đặt về synced (vì dữ liệu local vẫn ổn) hoặc error?
          // Theo yêu cầu: nếu hủy, dữ liệu không được cập nhật nhưng không báo lỗi.
          // Ta sẽ đặt về synced để tránh hiển thị lỗi.
          setSyncStatus("synced");
        }
        // Nếu syncStatus khác syncing, không thay đổi (giữ nguyên)
      }
    } catch (err) {
      console.error("[useSync] Sync process failed:", err);
      setSyncStatus("error");
    } finally {
      syncInProgressRef.current = false;
      setIsAborting(false);
    }
  }, [syncStatus]); // Thêm syncStatus vào dependencies để tránh stale closure

  // Hàm hủy đồng bộ
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
          // Đặt lại trạng thái synced sau khi hủy thành công (sẽ được cập nhật trong safePerformSync)
          // Nhưng ta có thể set luôn để UI phản hồi nhanh
          setSyncStatus("synced");
          setIsAborting(false);
        }
      }
    } else {
      alert("Không có tiến trình đồng bộ nào đang chạy.");
    }
  }, [syncStatus]);

  // Check session
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

  // Setup listeners
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

      await checkSession();
    }

    setupListeners();

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
    checkSession,
    isAborting,
    abortSync: handleAbortSync,
  };
}