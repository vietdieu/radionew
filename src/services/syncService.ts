import { getSupabaseClientAsync } from "./supabaseClient";
import { 
  getAllBriefings, 
  saveBriefing, 
  deleteBriefing, 
  getVoiceHistory, 
  saveVoiceHistory, 
  clearVoiceHistory,
  loadSyncQueue,
  saveSyncQueue as saveSyncQueueToDB,
  clearSyncQueue as clearSyncQueueFromDB,
  SyncQueueItem as StorageSyncQueueItem
} from "./storageService";
import { SavedSummary, VoiceHistoryItem } from "../types";
import { UserPreferences } from "../components/UserPreferencesProvider";

// Sử dụng lại kiểu từ storageService để đồng bộ
export type SyncQueueItem = StorageSyncQueueItem;

// ===== BIẾN QUẢN LÝ ABORT =====
let currentSyncAbortController: AbortController | null = null;

// ===== HÀM HỦY ĐỒNG BỘ =====
export function abortSync(): boolean {
  if (currentSyncAbortController) {
    currentSyncAbortController.abort();
    console.log("[Sync] Abort signal sent.");
    return true;
  }
  return false;
}

// ================== OFFLINE QUEUE MANAGEMENT ==================

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    return await loadSyncQueue();
  } catch (err) {
    console.error("[Sync] Failed to read sync queue:", err);
    return [];
  }
}

export async function saveSyncQueue(queue: SyncQueueItem[]): Promise<void> {
  try {
    await saveSyncQueueToDB(queue);
  } catch (err) {
    console.error("[Sync] Failed to save sync queue:", err);
  }
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, "id" | "timestamp">): Promise<void> {
  const queue = await getSyncQueue();
  const newItem: SyncQueueItem = {
    ...item,
    id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now()
  };

  // Optimize queue: remove redundant pending saves if delete follows
  let filtered = queue;
  if (item.targetId) {
    if (item.action === "delete") {
      filtered = queue.filter(q => !(q.targetId === item.targetId && q.action === "save"));
    } else if (item.action === "save") {
      filtered = queue.filter(q => !(q.targetId === item.targetId && q.action === "save"));
    }
  }

  filtered.push(newItem);
  await saveSyncQueue(filtered);
  console.log(`[Sync Queue] Added item: ${item.type} (${item.action})`);
}

export async function clearSyncQueue(): Promise<void> {
  await clearSyncQueueFromDB();
  // Xóa key localStorage cũ để giải phóng bộ nhớ
  try {
    localStorage.removeItem('commutecast_sync_queue');
  } catch (e) {
    // ignore
  }
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

// ================== SYNC PROCESSOR (CÓ HỖ TRỢ ABORT) ==================

export async function processSyncQueueAsync(signal?: AbortSignal): Promise<boolean> {
  if (!isOnline()) {
    console.warn("[Sync Queue] Offline, cannot process.");
    return false;
  }
  if (signal?.aborted) {
    console.warn("[Sync Queue] Aborted before processing.");
    return false;
  }

  const supabase = await getSupabaseClientAsync();
  if (!supabase) return false;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) return false;

  const userId = session.user.id;
  const queue = await getSyncQueue();
  if (queue.length === 0) return true;

  console.log(`[Sync Queue] Processing ${queue.length} items from offline queue...`);
  const failedItems: SyncQueueItem[] = [];

  for (const item of queue) {
    // Kiểm tra hủy
    if (signal?.aborted) {
      console.log("[Sync Queue] Aborted during processing.");
      // Lưu lại các item chưa xử lý để xử lý sau
      const remaining = queue.slice(queue.indexOf(item));
      await saveSyncQueue([...failedItems, ...remaining]);
      return false;
    }

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

  await saveSyncQueue(failedItems);
  return failedItems.length === 0;
}

// ================== TWO-WAY SYNCHRONIZATION (CÓ HỖ TRỢ ABORT) ==================

export async function performFullSyncAsync(): Promise<boolean> {
  if (!isOnline()) {
    console.warn("[Sync] Offline, cannot sync.");
    return false;
  }

  // Nếu trình duyệt đang tổng hợp âm thanh, hoãn chạy đồng bộ đầy đủ
  if (typeof window !== "undefined" && (window as any).isCommuteCastGeneratingBriefing) {
    console.log("[SyncService] Audio generation is in progress. Deferring full sync.");
    return false;
  }

  // Hủy đồng bộ cũ nếu có
  if (currentSyncAbortController) {
    currentSyncAbortController.abort();
  }

  const controller = new AbortController();
  currentSyncAbortController = controller;
  const signal = controller.signal;

  const supabase = await getSupabaseClientAsync();
  if (!supabase) {
    currentSyncAbortController = null;
    return false;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    currentSyncAbortController = null;
    return false;
  }

  const userId = session.user.id;
  console.log(`[Sync] Starting full two-way synchronization for User: ${userId}`);

  try {
    // 0. Process pending offline queue (có hỗ trợ abort)
    const queueOk = await processSyncQueueAsync(signal);
    if (signal.aborted) throw new Error('AbortError');
    if (!queueOk) {
      console.warn("[Sync] Queue processing failed, but continuing with cloud sync.");
    }

    // 1. Sync UserPreferences
    if (signal.aborted) throw new Error('AbortError');
    const { data: prefData, error: prefErr } = await supabase
      .from("user_preferences")
      .select("preferences, updated_at", { signal })
      .eq("user_id", userId)
      .maybeSingle();

    if (signal.aborted) throw new Error('AbortError');
    if (prefErr) console.warn("[Sync] Error loading cloud user preferences:", prefErr);

    const localPrefStr = localStorage.getItem("commutecast_user_preferences");
    const localPref = localPrefStr ? JSON.parse(localPrefStr) : null;

    if (localPref && prefData) {
      localStorage.setItem("commutecast_user_preferences", JSON.stringify(prefData.preferences));
    } else if (localPref && !prefData) {
      if (signal.aborted) throw new Error('AbortError');
      await supabase.from("user_preferences").upsert({
        user_id: userId,
        preferences: localPref,
        updated_at: new Date().toISOString()
      }, { signal });
    } else if (!localPref && prefData) {
      localStorage.setItem("commutecast_user_preferences", JSON.stringify(prefData.preferences));
    }

    // 2. Sync VoiceHistory
    if (signal.aborted) throw new Error('AbortError');
    const { data: cloudVoice, error: voiceErr } = await supabase
      .from("voice_history")
      .select("*", { signal })
      .eq("user_id", userId);

    if (signal.aborted) throw new Error('AbortError');
    if (voiceErr) console.warn("[Sync] Error loading cloud voice history:", voiceErr);

    const localVoice = await getVoiceHistory();

    if (cloudVoice && cloudVoice.length > 0) {
      for (const item of cloudVoice) {
        if (signal.aborted) throw new Error('AbortError');
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
    // Upload local-only voice items
    if (localVoice.length > 0) {
      for (const item of localVoice) {
        if (signal.aborted) throw new Error('AbortError');
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
          }, { signal });
        }
      }
    }

    // 3. Sync Briefings (Two-Way Conflict Resolution)
    if (signal.aborted) throw new Error('AbortError');
    const { data: cloudBriefings, error: briefErr } = await supabase
      .from("briefings")
      .select("*", { signal })
      .eq("user_id", userId);

    if (signal.aborted) throw new Error('AbortError');
    if (briefErr) throw briefErr;

    const localBriefings = await getAllBriefings(true);

    const cloudBriefingsMap = new Map<string, any>();
    if (cloudBriefings) {
      cloudBriefings.forEach(cb => cloudBriefingsMap.set(cb.id, cb));
    }

    const localBriefingsMap = new Map<string, SavedSummary>();
    localBriefings.forEach(lb => localBriefingsMap.set(lb.id, lb));

    // A. Sync from Cloud to Local
    for (const [id, cb] of cloudBriefingsMap.entries()) {
      if (signal.aborted) throw new Error('AbortError');
      const lb = localBriefingsMap.get(id);

      if (!lb) {
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
        const cbDate = cb.updated_at ? new Date(cb.updated_at) : parseTimestamp(cb.timestamp);
        const lbDate = parseTimestamp(lb.timestamp);

        if (cbDate.getTime() > lbDate.getTime()) {
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
          console.log(`[Sync] Local has newer version of briefing ${id}. Overwriting cloud...`);
          if (signal.aborted) throw new Error('AbortError');
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
          }, { signal });
        }
      }
    }

    // B. Sync from Local to Cloud
    for (const [id, lb] of localBriefingsMap.entries()) {
      if (signal.aborted) throw new Error('AbortError');
      if (!cloudBriefingsMap.has(id)) {
        console.log(`[Sync] Uploading local briefing ${id} to cloud...`);
        if (signal.aborted) throw new Error('AbortError');
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
        }, { signal });
      }
    }

    // Hoàn thành thành công
    currentSyncAbortController = null;
    console.log("[Sync] Full cloud-local synchronization completed successfully.");
    return true;

  } catch (err: any) {
    if (err.message === 'AbortError') {
      console.warn("[Sync] Synchronization aborted by user.");
      // Không coi là lỗi, trả về false
      return false;
    }
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
  } finally {
    // Nếu controller vẫn là controller hiện tại, giải phóng
    if (currentSyncAbortController === controller) {
      currentSyncAbortController = null;
    }
  }
}

// ================== INDIVIDUAL SYNC HELPERS ==================

export async function syncSaveBriefingAsync(briefing: SavedSummary): Promise<void> {
  // Always save locally first
  await saveBriefing(briefing);

  const supabase = await getSupabaseClientAsync();
  if (!isOnline() || !supabase) {
    await addToSyncQueue({ type: "briefing", action: "save", targetId: briefing.id, data: briefing });
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    await addToSyncQueue({ type: "briefing", action: "save", targetId: briefing.id, data: briefing });
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
    await addToSyncQueue({ type: "briefing", action: "save", targetId: briefing.id, data: briefing });
  }
}

export async function syncDeleteBriefingAsync(id: string): Promise<void> {
  // Always delete locally first
  await deleteBriefing(id);

  const supabase = await getSupabaseClientAsync();
  if (!isOnline() || !supabase) {
    await addToSyncQueue({ type: "briefing", action: "delete", targetId: id });
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    await addToSyncQueue({ type: "briefing", action: "delete", targetId: id });
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
    await addToSyncQueue({ type: "briefing", action: "delete", targetId: id });
  }
}

export async function syncSavePreferencesAsync(preferences: UserPreferences): Promise<void> {
  // Save locally
  localStorage.setItem("commutecast_user_preferences", JSON.stringify(preferences));

  const supabase = await getSupabaseClientAsync();
  if (!isOnline() || !supabase) {
    await addToSyncQueue({ type: "preferences", action: "save", data: preferences });
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    await addToSyncQueue({ type: "preferences", action: "save", data: preferences });
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
    await addToSyncQueue({ type: "preferences", action: "save", data: preferences });
  }
}

export async function syncSaveVoiceHistoryAsync(item: Partial<VoiceHistoryItem>): Promise<VoiceHistoryItem> {
  // Save locally first
  const saved = await saveVoiceHistory(item);

  const supabase = await getSupabaseClientAsync();
  if (!isOnline() || !supabase) {
    await addToSyncQueue({ type: "voice_history", action: "save", targetId: saved.id, data: saved });
    return saved;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    await addToSyncQueue({ type: "voice_history", action: "save", targetId: saved.id, data: saved });
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
    await addToSyncQueue({ type: "voice_history", action: "save", targetId: saved.id, data: saved });
  }

  return saved;
}

export async function syncClearVoiceHistoryAsync(): Promise<void> {
  // Clear locally
  await clearVoiceHistory();

  const supabase = await getSupabaseClientAsync();
  if (!isOnline() || !supabase) {
    await addToSyncQueue({ type: "voice_history", action: "clear" });
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    await addToSyncQueue({ type: "voice_history", action: "clear" });
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
    await addToSyncQueue({ type: "voice_history", action: "clear" });
  }
}
