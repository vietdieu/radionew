import { createClient, SupabaseClient } from "@supabase/supabase-js";

let clientInstance: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

export async function getSupabaseClientAsync(): Promise<SupabaseClient | null> {
  if (clientInstance) return clientInstance;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Fetch config from server API
      const res = await fetch("/api/supabase-config");
      if (!res.ok) {
        throw new Error("Failed to fetch Supabase config from server.");
      }
      const data = await res.json();
      const { supabaseUrl, supabaseAnonKey } = data;

      if (!supabaseUrl || !supabaseAnonKey) {
        console.warn("[Supabase Client] Config variables missing from server config response.");
        return null;
      }

      // 2. Initialize Supabase Client
      clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
        },
      });

      console.log("[Supabase Client] Client initialized successfully.");
      return clientInstance;
    } catch (err) {
      console.error("[Supabase Client] Failed to initialize Supabase client:", err);
      return null;
    }
  })();

  return initPromise;
}

// Quick checker to see if Supabase client is ready synchronously
export function getLoadedSupabaseClient(): SupabaseClient | null {
  return clientInstance;
}
