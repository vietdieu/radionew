import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { cloudSyncStatus } from "./cloudSyncStatus";
import { logger } from "../utils/logger";

let clientInstance: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

export async function getSupabaseClientAsync(forceRetry = false): Promise<SupabaseClient | null> {
  if (clientInstance) return clientInstance;

  if (initPromise && !forceRetry) return initPromise;

  cloudSyncStatus.setState("INITIALIZING");

  initPromise = (async () => {
    try {
      if (typeof window !== "undefined" && !window.navigator.onLine) {
        cloudSyncStatus.setState("OFFLINE");
        initPromise = null; // Clear so we can retry on next connection
        return null;
      }

      // 1. Fetch config from server API
      const res = await fetch("/api/supabase-config");
      if (!res.ok) {
        throw new Error("Failed to fetch Supabase config from server.");
      }
      const data = await res.json();

      if (!data.configured) {
        logger.warn("[Supabase Client] Supabase is not configured on the backend. Mode: MISCONFIGURED.");
        cloudSyncStatus.setState("MISCONFIGURED");
        initPromise = null;
        return null;
      }

      const { url, anonKey } = data;

      // 2. Connection Validation (lightweight health check ping)
      try {
        const pingRes = await fetch(`${url}/rest/v1/`, {
          headers: {
            apikey: anonKey,
          },
          // Keep a short 4-second timeout so it never blocks the app
          signal: AbortSignal.timeout(4000)
        });

        if (pingRes.status === 401 || pingRes.status === 403) {
          logger.error("[Supabase Client] Supabase key rejected by server (401/403 Unauthorized). Setting MISCONFIGURED.");
          cloudSyncStatus.setState("MISCONFIGURED");
          initPromise = null;
          return null;
        }

        // Successfully contacted and authenticated! Now safe to initialize createClient
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
        return clientInstance;
      } catch (pingErr: any) {
        logger.warn("[Supabase Client] Connection health check failed (host unreachable or timeout). Setting to OFFLINE.", pingErr);
        cloudSyncStatus.setState("OFFLINE");
        initPromise = null; // Clear so we can retry on next online event
        return null;
      }
    } catch (err: any) {
      logger.error("[Supabase Client] Failed to initialize Supabase client:", err);
      cloudSyncStatus.setState("LOCAL_ONLY");
      initPromise = null; // Clear so we can retry
      return null;
    }
  })();

  return initPromise;
}

// Quick checker to see if Supabase client is ready synchronously
export function getLoadedSupabaseClient(): SupabaseClient | null {
  return clientInstance;
}

