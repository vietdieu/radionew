import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { cloudSyncStatus } from "./cloudSyncStatus";
import { logger } from "../utils/logger";

let clientInstance: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

export async function getSupabaseClientAsync(): Promise<SupabaseClient | null> {
  if (clientInstance) return clientInstance;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (typeof window !== "undefined" && !window.navigator.onLine) {
        cloudSyncStatus.setState("OFFLINE");
        return null;
      }

      // 1. Fetch config from server API
      const res = await fetch("/api/supabase-config");
      if (!res.ok) {
        throw new Error("Failed to fetch Supabase config from server.");
      }
      const data = await res.json();
      const { supabaseUrl, supabaseAnonKey } = data;

      // 2. Validate configuration credentials (check for missing or default dummy values)
      if (!cloudSyncStatus.isConfigValid(supabaseUrl, supabaseAnonKey)) {
        logger.warn("[Supabase Client] Config is missing or using default sandbox credentials. Transitioning to MISCONFIGURED (Local Storage mode only).");
        cloudSyncStatus.setState("MISCONFIGURED");
        return null;
      }

      // 3. Initialize Supabase Client
      clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
        },
      });

      logger.info("[Supabase Client] Client initialized successfully.");
      cloudSyncStatus.setState("CONNECTED");
      return clientInstance;
    } catch (err: any) {
      logger.error("[Supabase Client] Failed to initialize Supabase client:", err);
      cloudSyncStatus.setState("LOCAL_ONLY");
      return null;
    }
  })();

  return initPromise;
}

// Quick checker to see if Supabase client is ready synchronously
export function getLoadedSupabaseClient(): SupabaseClient | null {
  return clientInstance;
}

