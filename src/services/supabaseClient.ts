import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { cloudSyncStatus } from "./cloudSyncStatus";
import { logger } from "../utils/logger";

let clientInstance: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;
let isMisconfigured = false; // Thêm flag để tránh retry
let lastAttemptTime = 0;
const RETRY_DELAY = 5 * 60 * 1000; // 5 phút

export async function getSupabaseClientAsync(forceRetry = false): Promise<SupabaseClient | null> {
  // Nếu đã xác định là sai cấu hình và không forced, trả về null ngay
  if (isMisconfigured && !forceRetry) {
    return null;
  }

  // Nếu đã có instance, trả về luôn
  if (clientInstance) return clientInstance;

  // Nếu đã có promise đang chạy và không forced, trả về promise đó
  if (initPromise && !forceRetry) return initPromise;

  // Nếu lần thử gần đây cách hiện tại chưa đủ lâu thì không retry (tránh spam)
  if (!forceRetry && Date.now() - lastAttemptTime < RETRY_DELAY) {
    return null;
  }

  cloudSyncStatus.setState("INITIALIZING");
  lastAttemptTime = Date.now();

  initPromise = (async () => {
    try {
      // Kiểm tra offline
      if (typeof window !== "undefined" && !window.navigator.onLine) {
        cloudSyncStatus.setState("OFFLINE");
        initPromise = null;
        return null;
      }

      // Lấy config từ server
      const res = await fetch("/api/supabase-config");
      if (!res.ok) {
        throw new Error("Failed to fetch Supabase config from server.");
      }
      const data = await res.json();

      if (!data.configured) {
        logger.warn("[Supabase Client] Supabase is not configured on the backend. Mode: MISCONFIGURED.");
        cloudSyncStatus.setState("MISCONFIGURED");
        isMisconfigured = true;
        initPromise = null;
        return null;
      }

      const { url, anonKey } = data;

      // Health check
      try {
        const pingRes = await fetch(`${url}/auth/v1/health`, {
          headers: { apikey: anonKey },
          signal: AbortSignal.timeout(4000)
        });

        if (pingRes.status === 401 || pingRes.status === 403) {
          logger.error("[Supabase Client] Supabase key rejected by server (401/403 Unauthorized). Setting MISCONFIGURED.");
          cloudSyncStatus.setState("MISCONFIGURED");
          isMisconfigured = true;
          initPromise = null;
          return null;
        }

        // Thành công
        clientInstance = createClient(url, anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage,
          },
        });

        logger.info("[Supabase Client] Client initialized and health check verified successfully.");
        cloudSyncStatus.setState("CONNECTED");
        isMisconfigured = false;
        return clientInstance;
      } catch (pingErr: any) {
        logger.warn("[Supabase Client] Connection health check failed (host unreachable or timeout). Setting to OFFLINE.", pingErr);
        cloudSyncStatus.setState("OFFLINE");
        initPromise = null;
        // Không đánh dấu misconfigured vì có thể mạng tạm thời, nhưng sẽ retry sau RETRY_DELAY
        return null;
      }
    } catch (err: any) {
      logger.error("[Supabase Client] Failed to initialize Supabase client:", err);
      cloudSyncStatus.setState("LOCAL_ONLY");
      isMisconfigured = true; // Nếu lỗi liên quan đến config, đánh dấu luôn
      initPromise = null;
      return null;
    }
  })();

  return initPromise;
}

export function getLoadedSupabaseClient(): SupabaseClient | null {
  return clientInstance;
}