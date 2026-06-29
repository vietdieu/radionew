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

  // Tối ưu hóa hàng đợi ngay lập tức trước khi thêm: xóa bỏ hành động trùng lặp hoặc mâu thuẫn
  let filtered = queue;
  if (item.targetId) {
    if (item.action === "delete") {
      // Nếu xóa, loại bỏ tất cả lệnh lưu trước đó của item này
      filtered = queue.filter(q => !(q.targetId === item.targetId && q.action === "save"));
    } else if (item.action === "save") {
      // Nếu lưu mới, loại bỏ lệnh lưu cũ trùng lặp của item này
      filtered = queue.filter(q => !(q.targetId === item.targetId && q.action === "save"));
    }
  }

  filtered.push(newItem);
  await saveSyncQueue(filtered);
  console.log(`[Sync Queue] Added item: ${item.type} (${item.action})`);
  
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("commutecast-sync-queue-updated"));
  }
}

export async function clearSyncQueue(): Promise<void> {
  await clearSyncQueueFromDB();
  try {
    localStorage.removeItem('commutecast_sync_queue');
  } catch (e) {
    // ignore
  }
}

// ================== UTILITIES & AUDIO STORAGE STRATEGY ==================

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export function parseTimestamp(ts: string | undefined): Date {
  if (!ts) return new Date(0);
  const parsed = Date.parse(ts);
  if (!isNaN(parsed)) return new Date(parsed);
  
  try {
    const match = ts.match(/(\d+)\/(\d+)\/(\d+)/);
    if (match) {
      const [_, day, month, year] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
  } catch (e) {}

  return new Date(0);
}

// Chuyển đổi chuỗi base64 thành Blob vật lý
export function base64ToBlob(base64: string, contentType = "audio/mpeg"): Blob {
  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
  const binaryString = window.atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

/**
 * Tải các đoạn âm thanh lên Supabase Storage độc lập và trả về Public URL
 */
export async function uploadAudioToSupabaseStorage(
  briefingId: string,
  audioChunks: string[]
): Promise<string | null> {
  if (!audioChunks || audioChunks.length === 0) return null;
  
  // Nếu đoạn âm thanh đầu tiên đã là một liên kết web, trả về luôn
  if (audioChunks[0]?.startsWith("http")) {
    return audioChunks[0];
  }

  const supabase = await getSupabaseClientAsync();
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) return null;

  const userId = session.user.id;

  try {
    // Ghép các mảnh âm thanh base64 thành một file Blob duy nhất
    const blobs = audioChunks.map(chunk => base64ToBlob(chunk));
    const combinedBlob = new Blob(blobs, { type: "audio/mpeg" });
    const fileName = `${userId}/${briefingId}.mp3`;
    const bucketName = "audio-briefings";

    // Thực hiện tải lên
    let { error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, combinedBlob, {
        contentType: "audio/mpeg",
        upsert: true
      });

    if (error) {
      // Nếu bucket chưa tồn tại, thử tạo bucket mới và upload lại
      if (error.message?.includes("bucket") || (error as any).status === 404) {
        console.warn(`[Storage] Bucket '${bucketName}' does not exist. Initializing...`);
        try {
          await supabase.storage.createBucket(bucketName, { public: true });
          const retryRes = await supabase.storage
            .from(bucketName)
            .upload(fileName, combinedBlob, {
              contentType: "audio/mpeg",
              upsert: true
            });
          if (retryRes.error) throw retryRes.error;
        } catch (createErr) {
          console.error("[Storage] Failed to create bucket or retry upload:", createErr);
          return null;
        }
      } else {
        throw error;
      }
    }

    // Lấy liên kết tải xuống công khai
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error(`[Storage] Error uploading audio for briefing ${briefingId}:`, err);
    return null;
  }
}

// ================== BATCH SYNC PROCESSOR (CÓ HỖ TRỢ ABORT & BATCHING) ==================

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

  console.log(`[Sync Queue] Batching & Processing ${queue.length} queue items...`);

  // --- BƯỚC 1: GOM CỤM & TỐI ƯU HÓA HOẠT ĐỘNG (CONSOLIDATION) ---
  const briefingsToSave = new Map<string, SavedSummary>();
  const briefingsToDelete = new Set<string>();
  const voiceHistoryToSave = new Map<string, VoiceHistoryItem>();
  let voiceHistoryClear = false;
  let latestPreferences: UserPreferences | null = null;

  for (const item of queue) {
    if (item.type === "briefing") {
      if (item.action === "save" && item.data) {
        const b = item.data as SavedSummary;
        briefingsToSave.set(b.id, b);
        briefingsToDelete.delete(b.id);
      } else if (item.action === "delete" && item.targetId) {
        briefingsToDelete.add(item.targetId);
        briefingsToSave.delete(item.targetId);
      }
    } else if (item.type === "voice_history") {
      if (item.action === "save" && item.data) {
        const v = item.data as VoiceHistoryItem;
        voiceHistoryToSave.set(v.id, v);
      } else if (item.action === "clear") {
        voiceHistoryClear = true;
        voiceHistoryToSave.clear();
      }
    } else if (item.type === "preferences") {
      if (item.action === "save" && item.data) {
        latestPreferences = item.data as UserPreferences;
      }
    }
  }

  // --- BƯỚC 2: THỰC THI CHUYỂN ĐỔI BATCH (REDUCE REQUESTS BY > 50%) ---
  try {
    // 1. Xử lý lưu các bản tin (Briefings) - có upload file audio lên storage riêng
    if (briefingsToSave.size > 0) {
      const sortedBriefings = Array.from(briefingsToSave.values());
      const BATCH_SIZE = 5;

      for (let i = 0; i < sortedBriefings.length; i += BATCH_SIZE) {
        if (signal?.aborted) throw new Error("AbortError");
        
        const batch = sortedBriefings.slice(i, i + BATCH_SIZE);
        const rowsToUpsert = [];

        for (const b of batch) {
          if (signal?.aborted) throw new Error("AbortError");

          // Tách riêng tệp âm thanh nặng, tải lên Storage để lấy link URL rút gọn
          let audioUrl: string | null = (b as any).audioUrl || null;
          if (!audioUrl && b.audioChunks && b.audioChunks.length > 0 && !b.audioChunks[0]?.startsWith("http")) {
            console.log(`[Sync] Uploading heavy base64 audio for briefing: ${b.id}`);
            audioUrl = await uploadAudioToSupabaseStorage(b.id, b.audioChunks);
            if (audioUrl) {
              (b as any).audioUrl = audioUrl;
              // Đồng bộ lại tệp audioUrl xuống IndexedDB cục bộ để giữ tệp sạch
              await saveBriefing(b);
            }
          }

          rowsToUpsert.push({
            id: b.id,
            user_id: userId,
            timestamp: b.timestamp,
            preferences: b.preferences,
            payload: b.payload,
            audio_chunks: audioUrl ? [audioUrl] : [], // Chỉ lưu url nhẹ vào database
            like_count: b.likeCount || 0,
            share_count: b.shareCount || 0,
            updated_at: new Date().toISOString()
          });
        }

        // Gọi 1 request duy nhất cho cả Batch upsert
        console.log(`[Sync] Batch upserting ${rowsToUpsert.length} briefings metadata to Cloud...`);
        const { error } = await supabase
          .from("briefings")
          .upsert(rowsToUpsert, { signal } as any);
        
        if (error) throw error;
      }
    }

    // 2. Xử lý xóa bản tin (Briefings)
    if (briefingsToDelete.size > 0) {
      if (signal?.aborted) throw new Error("AbortError");
      const idsToDelete = Array.from(briefingsToDelete);
      console.log(`[Sync] Batch deleting ${idsToDelete.length} briefings from Cloud...`);
      
      const { error } = await supabase
        .from("briefings")
        .delete({ signal } as any)
        .in("id", idsToDelete)
        .eq("user_id", userId);

      if (error) throw error;
    }

    // 3. Xử lý lưu lịch sử voice (Voice History)
    if (voiceHistoryClear) {
      if (signal?.aborted) throw new Error("AbortError");
      console.log("[Sync] Clearing all voice history from Cloud...");
      const { error } = await supabase
        .from("voice_history")
        .delete({ signal } as any)
        .eq("user_id", userId);
      if (error) throw error;
    }

    if (voiceHistoryToSave.size > 0) {
      const voiceItems = Array.from(voiceHistoryToSave.values());
      const BATCH_SIZE = 10;

      for (let i = 0; i < voiceItems.length; i += BATCH_SIZE) {
        if (signal?.aborted) throw new Error("AbortError");
        const batch = voiceItems.slice(i, i + BATCH_SIZE);
        const rows = batch.map(v => ({
          id: v.id,
          user_id: userId,
          query: v.query,
          answer: v.answer,
          language: v.language,
          sources: v.sources || [],
          timestamp: v.timestamp,
          updated_at: new Date().toISOString()
        }));

        console.log(`[Sync] Batch upserting ${rows.length} voice history items to Cloud...`);
        const { error } = await supabase
          .from("voice_history")
          .upsert(rows, { signal } as any);
        if (error) throw error;
      }
    }

    // 4. Xử lý lưu cấu hình (Preferences)
    if (latestPreferences) {
      if (signal?.aborted) throw new Error("AbortError");
      console.log("[Sync] Syncing latest user preferences to Cloud...");
      const { error } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: userId,
          preferences: latestPreferences,
          updated_at: new Date().toISOString()
        }, { signal } as any);
      if (error) throw error;
    }

    // Tất cả xử lý batch đã thành công, xóa sạch hàng đợi đồng bộ cục bộ
    await clearSyncQueue();
    console.log("[Sync Queue] Batch processing completed successfully. Queue cleared!");
    return true;

  } catch (err: any) {
    if (err.message === "AbortError" || signal?.aborted) {
      console.warn("[Sync Queue] Batch processing aborted.");
      return false;
    }
    console.error("[Sync Queue] Batch processing error:", err);
    return false;
  }
}

// ================== TWO-WAY SYNCHRONIZATION WITH DELTA SYNC & CONFLICT RESOLUTION ==================

export async function performFullSyncAsync(): Promise<boolean> {
  if (!isOnline()) {
    console.warn("[Sync] Offline, cannot sync.");
    return false;
  }

  // Defer sync if synthesizer is currently creating audio
  if (typeof window !== "undefined" && (window as any).isCommuteCastGeneratingBriefing) {
    console.log("[SyncService] Audio generation is in progress. Deferring full sync.");
    return false;
  }

  // Abort previous run
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
    // 0. Process pending offline queue (using our efficient Batch sync mechanism)
    const queueOk = await processSyncQueueAsync(signal);
    if (signal.aborted) throw new Error('AbortError');
    if (!queueOk) {
      console.warn("[Sync] Batch queue processing failed or was empty, continuing with cloud download.");
    }

    // Lấy mốc thời gian đồng bộ cuối cùng của thiết bị này (Delta Sync)
    const lastSyncAt = localStorage.getItem("commutecast_last_sync_at") || null;
    const currentSyncTime = new Date().toISOString();

    // 1. Sync UserPreferences
    if (signal.aborted) throw new Error('AbortError');
    const { data: prefData, error: prefErr } = await supabase
      .from("user_preferences")
      .select("preferences, updated_at", { signal } as any)
      .eq("user_id", userId)
      .maybeSingle();

    if (signal.aborted) throw new Error('AbortError');
    if (prefErr) console.warn("[Sync] Error loading cloud user preferences:", prefErr);

    const localPrefStr = localStorage.getItem("commutecast_user_preferences");
    const localPref = localPrefStr ? JSON.parse(localPrefStr) : null;

    if (localPref && prefData) {
      // Last-Write-Wins (LWW)
      const cloudUpdated = prefData.updated_at ? new Date(prefData.updated_at) : new Date(0);
      const localUpdated = lastSyncAt ? new Date(lastSyncAt) : new Date(0);
      
      if (cloudUpdated.getTime() > localUpdated.getTime()) {
        localStorage.setItem("commutecast_user_preferences", JSON.stringify(prefData.preferences));
      } else {
        await supabase.from("user_preferences").upsert({
          user_id: userId,
          preferences: localPref,
          updated_at: new Date().toISOString()
        }, { signal } as any);
      }
    } else if (localPref && !prefData) {
      await supabase.from("user_preferences").upsert({
        user_id: userId,
        preferences: localPref,
        updated_at: new Date().toISOString()
      }, { signal } as any);
    } else if (!localPref && prefData) {
      localStorage.setItem("commutecast_user_preferences", JSON.stringify(prefData.preferences));
    }

    // 2. Sync VoiceHistory (Delta Sync)
    if (signal.aborted) throw new Error('AbortError');
    let voiceQuery = supabase.from("voice_history").select("*", { signal } as any).eq("user_id", userId);
    
    // Áp dụng Delta Sync: chỉ tải các bản ghi thay đổi từ sau mốc lastSyncAt
    if (lastSyncAt) {
      voiceQuery = voiceQuery.gt("updated_at", lastSyncAt);
    }
    const { data: cloudVoice, error: voiceErr } = await voiceQuery;

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
          }, { signal } as any);
        }
      }
    }

    // 3. Sync Briefings (Two-Way Delta Sync với Conflict Resolution LWW)
    if (signal.aborted) throw new Error('AbortError');
    let briefingsQuery = supabase.from("briefings").select("*", { signal } as any).eq("user_id", userId);
    
    // Áp dụng Delta Sync cho Briefings
    if (lastSyncAt) {
      briefingsQuery = briefingsQuery.gt("updated_at", lastSyncAt);
    }
    const { data: cloudBriefings, error: briefErr } = await briefingsQuery;

    if (signal.aborted) throw new Error('AbortError');
    if (briefErr) throw briefErr;

    const localBriefings = await getAllBriefings(true);

    const cloudBriefingsMap = new Map<string, any>();
    if (cloudBriefings) {
      cloudBriefings.forEach(cb => cloudBriefingsMap.set(cb.id, cb));
    }

    const localBriefingsMap = new Map<string, SavedSummary>();
    localBriefings.forEach(lb => localBriefingsMap.set(lb.id, lb));

    // A. Xử lý đồng bộ từ Cloud về Local
    for (const [id, cb] of cloudBriefingsMap.entries()) {
      if (signal.aborted) throw new Error('AbortError');
      const lb = localBriefingsMap.get(id);

      // Link âm thanh trực tuyến
      const cloudAudioChunks = cb.audio_chunks || [];

      if (!lb) {
        console.log(`[Sync] Downloading new briefing ${id} from cloud...`);
        await saveBriefing({
          id: cb.id,
          timestamp: cb.timestamp,
          preferences: cb.preferences,
          payload: cb.payload,
          audioChunks: cloudAudioChunks, // Lưu link URL cloud tải xuống
          likeCount: cb.like_count || 0,
          shareCount: cb.share_count || 0
        });
      } else {
        const cbDate = cb.updated_at ? new Date(cb.updated_at) : parseTimestamp(cb.timestamp);
        const lbDate = parseTimestamp(lb.timestamp);

        // Conflict Resolution: Last-Write-Wins (LWW)
        if (cbDate.getTime() > lbDate.getTime()) {
          console.log(`[Sync] Cloud has newer version of briefing ${id} (LWW). Overwriting local...`);
          
          // Giữ lại file audio base64 ở local nếu có và không bị thay đổi
          const localAudio = lb.audioChunks && lb.audioChunks.length > 0 && !lb.audioChunks[0]?.startsWith("http") 
            ? lb.audioChunks 
            : cloudAudioChunks;

          await saveBriefing({
            id: cb.id,
            timestamp: cb.timestamp,
            preferences: cb.preferences,
            payload: cb.payload,
            audioChunks: localAudio,
            likeCount: cb.like_count || 0,
            shareCount: cb.share_count || 0
          });
        } else if (lbDate.getTime() > cbDate.getTime()) {
          console.log(`[Sync] Local has newer version of briefing ${id} (LWW). Overwriting cloud...`);
          
          // Chuẩn bị tải âm thanh cục bộ lên Cloud
          let finalAudioUrl = (lb as any).audioUrl || null;
          if (!finalAudioUrl && lb.audioChunks && lb.audioChunks.length > 0 && !lb.audioChunks[0]?.startsWith("http")) {
            finalAudioUrl = await uploadAudioToSupabaseStorage(lb.id, lb.audioChunks);
            if (finalAudioUrl) {
              (lb as any).audioUrl = finalAudioUrl;
              await saveBriefing(lb);
            }
          }

          if (signal.aborted) throw new Error('AbortError');
          await supabase.from("briefings").upsert({
            id: lb.id,
            user_id: userId,
            timestamp: lb.timestamp,
            preferences: lb.preferences,
            payload: lb.payload,
            audio_chunks: finalAudioUrl ? [finalAudioUrl] : [],
            like_count: lb.likeCount || 0,
            share_count: lb.shareCount || 0,
            updated_at: new Date().toISOString()
          }, { signal } as any);
        }
      }
    }

    // B. Xử lý đồng bộ từ Local lên Cloud (chỉ những mục local-only và không có trên cloud)
    for (const [id, lb] of localBriefingsMap.entries()) {
      if (signal.aborted) throw new Error('AbortError');
      
      // Nếu không có mốc lastSyncAt hoặc mục này chưa từng được lưu lên cloud
      if (!cloudBriefingsMap.has(id)) {
        // Kiểm tra xem đã tồn tại thực sự trên cloud chưa bằng một query nhẹ
        const { data: remoteExists } = await supabase
          .from("briefings")
          .select("id")
          .eq("id", id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!remoteExists) {
          console.log(`[Sync] Uploading local-only briefing ${id} to cloud...`);
          
          let finalAudioUrl = (lb as any).audioUrl || null;
          if (!finalAudioUrl && lb.audioChunks && lb.audioChunks.length > 0 && !lb.audioChunks[0]?.startsWith("http")) {
            finalAudioUrl = await uploadAudioToSupabaseStorage(lb.id, lb.audioChunks);
            if (finalAudioUrl) {
              (lb as any).audioUrl = finalAudioUrl;
              await saveBriefing(lb);
            }
          }

          if (signal.aborted) throw new Error('AbortError');
          await supabase.from("briefings").upsert({
            id: lb.id,
            user_id: userId,
            timestamp: lb.timestamp,
            preferences: lb.preferences,
            payload: lb.payload,
            audio_chunks: finalAudioUrl ? [finalAudioUrl] : [],
            like_count: lb.likeCount || 0,
            share_count: lb.shareCount || 0,
            updated_at: new Date().toISOString()
          }, { signal } as any);
        }
      }
    }

    // Ghi lại thời điểm đồng bộ thành công của thiết bị này
    localStorage.setItem("commutecast_last_sync_at", currentSyncTime);
    currentSyncAbortController = null;
    console.log("[Sync] Full cloud-local synchronization completed successfully!");
    return true;

  } catch (err: any) {
    if (err.message === 'AbortError') {
      console.warn("[Sync] Synchronization aborted by user.");
      return false;
    }
    console.error("[Sync] Error performing full synchronization:", err);
    return false;
  } finally {
    if (currentSyncAbortController === controller) {
      currentSyncAbortController = null;
    }
  }
}

// ================== INDIVIDUAL SYNC HELPERS (GRADUALLY REDIRECTED TO QUEUE DEBOUNCE) ==================

export async function syncSaveBriefingAsync(briefing: SavedSummary): Promise<void> {
  // Luôn luôn lưu cục bộ trước
  await saveBriefing(briefing);

  // Thêm vào hàng đợi đồng bộ. Hệ thống useSync sẽ tự động debounce 3-5 giây và chạy batch sync cực kỳ mượt mà!
  await addToSyncQueue({ type: "briefing", action: "save", targetId: briefing.id, data: briefing });
}

export async function syncDeleteBriefingAsync(id: string): Promise<void> {
  // Luôn luôn xóa cục bộ trước
  await deleteBriefing(id);

  // Thêm vào hàng đợi đồng bộ
  await addToSyncQueue({ type: "briefing", action: "delete", targetId: id });
}

export async function syncSavePreferencesAsync(preferences: UserPreferences): Promise<void> {
  // Lưu cục bộ trước
  localStorage.setItem("commutecast_user_preferences", JSON.stringify(preferences));

  // Thêm vào hàng đợi đồng bộ
  await addToSyncQueue({ type: "preferences", action: "save", data: preferences });
}

export async function syncSaveVoiceHistoryAsync(item: Partial<VoiceHistoryItem>): Promise<VoiceHistoryItem> {
  // Lưu cục bộ trước
  const saved = await saveVoiceHistory(item);

  // Thêm vào hàng đợi đồng bộ
  await addToSyncQueue({ type: "voice_history", action: "save", targetId: saved.id, data: saved });
  return saved;
}

export async function syncClearVoiceHistoryAsync(): Promise<void> {
  // Xóa cục bộ trước
  await clearVoiceHistory();

  // Thêm vào hàng đợi đồng bộ
  await addToSyncQueue({ type: "voice_history", action: "clear" });
}
