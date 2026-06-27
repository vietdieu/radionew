import { getSupabaseClientAsync } from "./supabaseClient";
import { 
  getAllBriefings, 
  saveBriefing, 
  deleteBriefing, 
  getVoiceHistory, 
  saveVoiceHistory, 
  clearVoiceHistory 
} from "./storageService";
import { SavedSummary, VoiceHistoryItem } from "../types";
import { UserPreferences } from "../components/UserPreferencesProvider";

export interface SyncQueueItem {
  id: string; // unique ID of the queue item
  type: "briefing" | "preferences" | "voice_history";
  action: "save" | "delete" | "clear";
  targetId?: string; // target item ID (e.g., briefing ID)
  data?: any; // serialized payload
  timestamp: number;
}

const SYNC_QUEUE_KEY = "commutecast_sync_queue";

// ================== OFFLINE QUEUE MANAGEMENT ==================

export function getSyncQueue(): SyncQueueItem[] {
  try {
    const queueStr = localStorage.getItem(SYNC_QUEUE_KEY);
    return queueStr ? JSON.parse(queueStr) : [];
  } catch (err) {
    console.error("[Sync] Failed to read sync queue:", err);
    return [];
  }
}

export function saveSyncQueue(queue: SyncQueueItem[]): void {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error("[Sync] Failed to save sync queue:", err);
  }
}

export function addToSyncQueue(item: Omit<SyncQueueItem, "id" | "timestamp">): void {
  const queue = getSyncQueue();
  const newItem: SyncQueueItem = {
    ...item,
    id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now()
  };

  // If there's an existing save/delete for the same item, optimize the queue
  let filtered = queue;
  if (item.targetId) {
    // If we delete an item, we can remove any pending saves for it
    if (item.action === "delete") {
      filtered = queue.filter(q => !(q.targetId === item.targetId && q.action === "save"));
    }
    // If we save an item, we can replace any existing pending saves for it
    else if (item.action === "save") {
      filtered = queue.filter(q => !(q.targetId === item.targetId && q.action === "save"));
    }
  }

  filtered.push(newItem);
  saveSyncQueue(filtered);
  console.log(`[Sync Queue] Added item: ${item.type} (${item.action})`);
}

export function clearSyncQueue(): void {
  localStorage.removeItem(SYNC_QUEUE_KEY);
}

// ================== SYNC UTILITIES ==================

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

// Helper to convert localized time string / timestamp string to Date
export function parseTimestamp(ts: string | undefined): Date {
  if (!ts) return new Date(0);
  const parsed = Date.parse(ts);
  if (!isNaN(parsed)) return new Date(parsed);
  
  // Hand-rolled parsing for "DD/MM/YYYY, HH:MM:SS" or similar
  try {
    const match = ts.match(/(\d+)\/(\d+)\/(\d+)/);
    if (match) {
      const [_, day, month, year] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
  } catch (e) {}

  return new Date(0);
}

// ================== SYNC PROCESSOR ==================

export async function processSyncQueueAsync(): Promise<boolean> {
  if (!isOnline()) return false;

  const supabase = await getSupabaseClientAsync();
  if (!supabase) return false;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) return false;

  const userId = session.user.id;
  const queue = getSyncQueue();
  if (queue.length === 0) return true;

  console.log(`[Sync Queue] Processing ${queue.length} items from offline queue...`);
  const failedItems: SyncQueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === "briefing") {
        if (item.action === "save" && item.data) {
          const b = item.data as SavedSummary;
          const { error } = await supabase
            .from("briefings")
            .upsert({
              id: b.id,
              user_id: userId,
              timestamp: b.timestamp,
              preferences: b.preferences,
              payload: b.payload,
              audio_chunks: b.audioChunks || [],
              like_count: b.likeCount || 0,
              share_count: b.shareCount || 0,
              updated_at: new Date().toISOString()
            });
          if (error) throw error;
        } else if (item.action === "delete" && item.targetId) {
          const { error } = await supabase
            .from("briefings")
            .delete()
            .eq("id", item.targetId)
            .eq("user_id", userId);
          if (error) throw error;
        }
      } 
      else if (item.type === "preferences") {
        if (item.action === "save" && item.data) {
          const { error } = await supabase
            .from("user_preferences")
            .upsert({
              user_id: userId,
              preferences: item.data,
              updated_at: new Date().toISOString()
            });
          if (error) throw error;
        }
      } 
      else if (item.type === "voice_history") {
        if (item.action === "save" && item.data) {
          const v = item.data as VoiceHistoryItem;
          const { error } = await supabase
            .from("voice_history")
            .upsert({
              id: v.id,
              user_id: userId,
              query: v.query,
              answer: v.answer,
              language: v.language,
              sources: v.sources || [],
              timestamp: v.timestamp,
              updated_at: new Date().toISOString()
            });
          if (error) throw error;
        } else if (item.action === "clear") {
          const { error } = await supabase
            .from("voice_history")
            .delete()
            .eq("user_id", userId);
          if (error) throw error;
        }
      }
    } catch (err) {
      console.error(`[Sync Queue] Failed to process sync item ${item.id}:`, err);
      failedItems.push(item);
    }
  }

  saveSyncQueue(failedItems);
  return failedItems.length === 0;
}

// ================== TWO-WAY SYNCHRONIZATION ==================

export async function performFullSyncAsync(): Promise<boolean> {
  if (!isOnline()) return false;

  // Nếu trình duyệt đang tổng hợp âm thanh, hoãn chạy đồng bộ đầy đủ để tránh xung đột băng thông & CPU
  if (typeof window !== "undefined" && (window as any).isCommuteCastGeneratingBriefing) {
    console.log("[SyncService] Audio generation is in progress. Deferring full sync.");
    return false;
  }

  const supabase = await getSupabaseClientAsync();
  if (!supabase) return false;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) return false;

  const userId = session.user.id;
  console.log(`[Sync] Starting full two-way synchronization for User: ${userId}`);

  try {
    // 0. Process any pending offline mutations first
    await processSyncQueueAsync();

    // 1. Sync UserPreferences
    const { data: prefData, error: prefErr } = await supabase
      .from("user_preferences")
      .select("preferences, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (prefErr) console.warn("[Sync] Error loading cloud user preferences:", prefErr);

    const localPrefStr = localStorage.getItem("commutecast_user_preferences");
    const localPref = localPrefStr ? JSON.parse(localPrefStr) : null;

    if (localPref && prefData) {
      // Both exist - keep latest or local by default
      // If user wants to sync cloud preference down, we can update local storage
      localStorage.setItem("commutecast_user_preferences", JSON.stringify(prefData.preferences));
    } else if (localPref && !prefData) {
      // Local exists, cloud doesn't - upload
      await supabase.from("user_preferences").upsert({
        user_id: userId,
        preferences: localPref,
        updated_at: new Date().toISOString()
      });
    } else if (!localPref && prefData) {
      // Cloud exists, local doesn't - download
      localStorage.setItem("commutecast_user_preferences", JSON.stringify(prefData.preferences));
    }

    // 2. Sync VoiceHistory
    const { data: cloudVoice, error: voiceErr } = await supabase
      .from("voice_history")
      .select("*")
      .eq("user_id", userId);

    if (voiceErr) console.warn("[Sync] Error loading cloud voice history:", voiceErr);

    const localVoice = await getVoiceHistory();

    if (cloudVoice && cloudVoice.length > 0) {
      // Simple merge: insert missing into local and upload missing to cloud
      for (const item of cloudVoice) {
        const existsLocally = localVoice.some(lv => lv.id === item.id);
        if (!existsLocally) {
          await saveVoiceHistory({
            id: item.id,
            timestamp: item.timestamp,
            query: item.query,
            answer: item.answer,
            language: item.language,
            sources: item.sources
          });
        }
      }
    }
    // Upload local-only voice items to cloud
    if (localVoice.length > 0) {
      for (const item of localVoice) {
        const existsOnCloud = cloudVoice?.some(cv => cv.id === item.id);
        if (!existsOnCloud) {
          await supabase.from("voice_history").upsert({
            id: item.id,
            user_id: userId,
            query: item.query,
            answer: item.answer,
            language: item.language,
            sources: item.sources || [],
            timestamp: item.timestamp,
            updated_at: new Date().toISOString()
          });
        }
      }
    }

    // 3. Sync Briefings (Two-Way Conflict Resolution)
    const { data: cloudBriefings, error: briefErr } = await supabase
      .from("briefings")
      .select("*")
      .eq("user_id", userId);

    if (briefErr) throw briefErr;

    const localBriefings = await getAllBriefings(true);

    const cloudBriefingsMap = new Map<string, any>();
    if (cloudBriefings) {
      cloudBriefings.forEach(cb => cloudBriefingsMap.set(cb.id, cb));
    }

    const localBriefingsMap = new Map<string, SavedSummary>();
    localBriefings.forEach(lb => localBriefingsMap.set(lb.id, lb));

    // A. Sync from Cloud to Local and handle conflicts
    for (const [id, cb] of cloudBriefingsMap.entries()) {
      const lb = localBriefingsMap.get(id);

      if (!lb) {
        // Cloud exists, Local doesn't - download
        console.log(`[Sync] Downloading briefing ${id} from cloud...`);
        await saveBriefing({
          id: cb.id,
          timestamp: cb.timestamp,
          preferences: cb.preferences,
          payload: cb.payload,
          audioChunks: cb.audio_chunks || [],
          likeCount: cb.like_count || 0,
          shareCount: cb.share_count || 0
        });
      } else {
        // Both exist - conflict resolution by updated_at or timestamp
        const cbDate = cb.updated_at ? new Date(cb.updated_at) : parseTimestamp(cb.timestamp);
        const lbDate = parseTimestamp(lb.timestamp);

        if (cbDate.getTime() > lbDate.getTime()) {
          // Cloud is newer - overwrite local
          console.log(`[Sync] Cloud has newer version of briefing ${id}. Overwriting local...`);
          await saveBriefing({
            id: cb.id,
            timestamp: cb.timestamp,
            preferences: cb.preferences,
            payload: cb.payload,
            audioChunks: cb.audio_chunks || [],
            likeCount: cb.like_count || 0,
            shareCount: cb.share_count || 0
          });
        } else if (lbDate.getTime() > cbDate.getTime()) {
          // Local is newer - overwrite cloud
          console.log(`[Sync] Local has newer version of briefing ${id}. Overwriting cloud...`);
          await supabase.from("briefings").upsert({
            id: lb.id,
            user_id: userId,
            timestamp: lb.timestamp,
            preferences: lb.preferences,
            payload: lb.payload,
            audio_chunks: lb.audioChunks || [],
            like_count: lb.likeCount || 0,
            share_count: lb.shareCount || 0,
            updated_at: new Date().toISOString()
          });
        }
      }
    }

    // B. Sync from Local to Cloud (Local items that don't exist on cloud)
    for (const [id, lb] of localBriefingsMap.entries()) {
      if (!cloudBriefingsMap.has(id)) {
        console.log(`[Sync] Uploading local briefing ${id} to cloud...`);
        await supabase.from("briefings").upsert({
          id: lb.id,
          user_id: userId,
          timestamp: lb.timestamp,
          preferences: lb.preferences,
          payload: lb.payload,
          audio_chunks: lb.audioChunks || [],
          like_count: lb.likeCount || 0,
          share_count: lb.shareCount || 0,
          updated_at: new Date().toISOString()
        });
      }
    }

    console.log("[Sync] Full cloud-local synchronization completed successfully.");
    return true;
  } catch (err: any) {
    console.error("[Sync] Error performing full synchronization:", err);
    if (err && (err.code === "42P01" || (err.message && err.message.includes("relation") && err.message.includes("does not exist")))) {
      console.warn(
        "⚠️ [Supabase DB Sync] LỖI: Bảng dữ liệu không tồn tại trong cơ sở dữ liệu Supabase của bạn.\n" +
        "Vui lòng copy và chạy đoạn lệnh sau trong Supabase SQL Editor:\n\n" +
        "CREATE TABLE IF NOT EXISTS user_preferences (\n" +
        "  user_id uuid references auth.users not null primary key,\n" +
        "  preferences jsonb not null default '{}'::jsonb,\n" +
        "  updated_at timestamp with time zone default timezone('utc'::text, now()) not null\n" +
        ");\n\n" +
        "CREATE TABLE IF NOT EXISTS voice_history (\n" +
        "  id text primary key,\n" +
        "  user_id uuid references auth.users not null,\n" +
        "  query text not null,\n" +
        "  answer text not null,\n" +
        "  language text not null,\n" +
        "  sources jsonb default '[]'::jsonb,\n" +
        "  timestamp text not null,\n" +
        "  updated_at timestamp with time zone default timezone('utc'::text, now()) not null\n" +
        ");\n\n" +
        "CREATE TABLE IF NOT EXISTS briefings (\n" +
        "  id text primary key,\n" +
        "  user_id uuid references auth.users not null,\n" +
        "  timestamp text not null,\n" +
        "  preferences jsonb not null,\n" +
        "  payload jsonb not null,\n" +
        "  audio_chunks text[] default '{}'::text[],\n" +
        "  like_count integer default 0,\n" +
        "  share_count integer default 0,\n" +
        "  updated_at timestamp with time zone default timezone('utc'::text, now()) not null\n" +
        ");\n\n" +
        "ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;\n" +
        "ALTER TABLE voice_history ENABLE ROW LEVEL SECURITY;\n" +
        "ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;\n\n" +
        "DROP POLICY IF EXISTS \"Users can manage their own preferences\" ON user_preferences;\n" +
        "CREATE POLICY \"Users can manage their own preferences\" ON user_preferences FOR ALL USING (auth.uid() = user_id);\n\n" +
        "DROP POLICY IF EXISTS \"Users can manage their own voice history\" ON voice_history;\n" +
        "CREATE POLICY \"Users can manage their own voice history\" ON voice_history FOR ALL USING (auth.uid() = user_id);\n\n" +
        "DROP POLICY IF EXISTS \"Users can manage their own briefings\" ON briefings;\n" +
        "CREATE POLICY \"Users can manage their own briefings\" ON briefings FOR ALL USING (auth.uid() = user_id);\n"
      );
    }
    return false;
  }
}

// ================== INDIVIDUAL SYNC HELPERS ==================

export async function syncSaveBriefingAsync(briefing: SavedSummary): Promise<void> {
  // Always save locally first
  await saveBriefing(briefing);

  const supabase = await getSupabaseClientAsync();
  if (!isOnline() || !supabase) {
    addToSyncQueue({ type: "briefing", action: "save", targetId: briefing.id, data: briefing });
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    // Save to queue for when they log in
    addToSyncQueue({ type: "briefing", action: "save", targetId: briefing.id, data: briefing });
    return;
  }

  try {
    const { error } = await supabase.from("briefings").upsert({
      id: briefing.id,
      user_id: session.user.id,
      timestamp: briefing.timestamp,
      preferences: briefing.preferences,
      payload: briefing.payload,
      audio_chunks: briefing.audioChunks || [],
      like_count: briefing.likeCount || 0,
      share_count: briefing.shareCount || 0,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
    console.log(`[Sync] Uploaded briefing ${briefing.id} directly to cloud.`);
  } catch (err) {
    console.warn(`[Sync] Failed to upload briefing ${briefing.id} directly. Queuing...`, err);
    addToSyncQueue({ type: "briefing", action: "save", targetId: briefing.id, data: briefing });
  }
}

export async function syncDeleteBriefingAsync(id: string): Promise<void> {
  // Always delete locally first
  await deleteBriefing(id);

  const supabase = await getSupabaseClientAsync();
  if (!isOnline() || !supabase) {
    addToSyncQueue({ type: "briefing", action: "delete", targetId: id });
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    addToSyncQueue({ type: "briefing", action: "delete", targetId: id });
    return;
  }

  try {
    const { error } = await supabase
      .from("briefings")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id);
    if (error) throw error;
    console.log(`[Sync] Deleted briefing ${id} directly from cloud.`);
  } catch (err) {
    console.warn(`[Sync] Failed to delete briefing ${id} directly. Queuing...`, err);
    addToSyncQueue({ type: "briefing", action: "delete", targetId: id });
  }
}

export async function syncSavePreferencesAsync(preferences: UserPreferences): Promise<void> {
  // Save locally
  localStorage.setItem("commutecast_user_preferences", JSON.stringify(preferences));

  const supabase = await getSupabaseClientAsync();
  if (!isOnline() || !supabase) {
    addToSyncQueue({ type: "preferences", action: "save", data: preferences });
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    addToSyncQueue({ type: "preferences", action: "save", data: preferences });
    return;
  }

  try {
    const { error } = await supabase.from("user_preferences").upsert({
      user_id: session.user.id,
      preferences,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
    console.log(`[Sync] Uploaded user preferences to cloud.`);
  } catch (err) {
    console.warn(`[Sync] Failed to upload preferences. Queuing...`, err);
    addToSyncQueue({ type: "preferences", action: "save", data: preferences });
  }
}

export async function syncSaveVoiceHistoryAsync(item: Partial<VoiceHistoryItem>): Promise<VoiceHistoryItem> {
  // Save locally first
  const saved = await saveVoiceHistory(item);

  const supabase = await getSupabaseClientAsync();
  if (!isOnline() || !supabase) {
    addToSyncQueue({ type: "voice_history", action: "save", targetId: saved.id, data: saved });
    return saved;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    addToSyncQueue({ type: "voice_history", action: "save", targetId: saved.id, data: saved });
    return saved;
  }

  try {
    const { error } = await supabase.from("voice_history").upsert({
      id: saved.id,
      user_id: session.user.id,
      query: saved.query,
      answer: saved.answer,
      language: saved.language,
      sources: saved.sources || [],
      timestamp: saved.timestamp,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
    console.log(`[Sync] Uploaded voice history item ${saved.id} directly to cloud.`);
  } catch (err) {
    console.warn(`[Sync] Failed to upload voice item. Queuing...`, err);
    addToSyncQueue({ type: "voice_history", action: "save", targetId: saved.id, data: saved });
  }

  return saved;
}

export async function syncClearVoiceHistoryAsync(): Promise<void> {
  // Clear locally
  await clearVoiceHistory();

  const supabase = await getSupabaseClientAsync();
  if (!isOnline() || !supabase) {
    addToSyncQueue({ type: "voice_history", action: "clear" });
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    addToSyncQueue({ type: "voice_history", action: "clear" });
    return;
  }

  try {
    const { error } = await supabase
      .from("voice_history")
      .delete()
      .eq("user_id", session.user.id);
    if (error) throw error;
    console.log(`[Sync] Cleared voice history directly from cloud.`);
  } catch (err) {
    console.warn(`[Sync] Failed to clear voice history. Queuing...`, err);
    addToSyncQueue({ type: "voice_history", action: "clear" });
  }
}
