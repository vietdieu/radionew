# CommuteCast 3.0: AI Broadcast Studio
## Document 02: System Architecture

### 1. High-Level Architecture Diagram

```
       +--------------------------------------------------------+
       |                     CLIENT (React)                     |
       |                                                        |
       |  +--------------------+         +-------------------+  |
       |  |  UI Layout Layers  | <-----> |   State Context   |  |
       |  | (Workspace/Player) |         | (App State, Queue)|  |
       |  +--------------------+         +-------------------+  |
       |            |                              ^            |
       |            v                              |            |
       |  +--------------------------------------------------+  |
       |  |                  Service Layer                   |  |
       |  |  * rssService.ts        * broadcastSpeechEngine  |  |
       |  |  * syncService.ts       * indexedDBQueue.ts      |  |
       |  +--------------------------------------------------+  |
       |            |                              |            |
       +------------|------------------------------|------------+
                    | (REST APIs / HTTPS)          | (Local Client Storage)
                    v                              v
       +----------------------------+    +-----------------------+
       |       BACKEND SERVER       |    |     Client DBs        |
       |        (Express.js)        |    |                       |
       |                            |    |  * IndexedDB (Queue)  |
       |  +----------------------+  |    |  * LocalStorage       |
       |  |     API Gateways     |  |    +-----------------------+
       |  +----------------------+  |
       |  | * /api/rss             |  |
       |  | * /api/tts             |  |
       |  | * /api/podcast         |  |
       |  +----------------------+  |
       |            |               |
       |            v               |
       |  +----------------------+  |
       |  |   Services & SDKs    |  |
       |  | * Gemini AI SDK      |  |
       |  | * Google Cloud TTS   |  |
       |  +----------------------+  |
       +----------------------------+
                    |
                    v (Cloud Integrations)
       +----------------------------+
       |      SUPABASE / CLOUD      |
       |  * Auth, User Profiles     |
       |  * Shared Briefing Storage |
       +----------------------------+
```

---

### 2. Dependency Graph & Module Map

The codebase is strictly structured into three key segments:
1.  **Frontend Views & App Container (`/src/App.tsx`, `/src/components/*`):** Handles visual state, inputs, dynamic layouts, and workspace rendering.
2.  **Service Abstraction Layer (`/src/services/*`):** Single-purpose modules coordinating local caching, cloud syncing, scheduling, audio orchestration, and API interactions.
3.  **Backend Proxy Core (`/server.ts`):** Express app managing resource-intensive tasks, secret API keys (Gemini, Google TTS, Supabase connection), XML RSS conversions, and media hosting.

#### Key Module Relationships:
*   `App.tsx` -> imports `broadcastSpeechEngine.ts` (for playback), `rssService.ts` (for feeds), `indexedDBQueue.ts` (for state queue curation), and `syncService.ts` (for preferences/profile backup).
*   `broadcastSpeechEngine.ts` -> wraps native Web Audio / PCM playback, communicating with `/api/tts` to stream audio chunks dynamically or caching them locally.
*   `syncService.ts` -> interacts with `supabaseClient.ts` to sync user configurations. If unauthenticated, it falls back to `preferenceService.ts` (LocalStorage).

---

### 3. State Flow Architecture

CommuteCast 3.0 employs a hierarchical state engine:

```
        [User Action: Add Feed / Trigger Briefing Compilation]
                               |
                               v
               [App State Context: Set IsLoading]
                               |
                               v
       [rssService.ts -> Calls /api/rss to Aggregrate & Parse]
                               |
                               v
      [Gemini AI (server.ts) compiles raw text to a script]
                               |
                               v
    [indexedDBQueue.ts packs chapters & audio metadata into Local Queue]
                               |
                               v
         [App State: Updated Queue & Active Audio Player]
```

*   **Durable State (Cloud):** Persisted in Supabase (feed definitions, historical briefs, credentials, user profiles).
*   **Persistent Local State:** Saved via `IndexedDB` (large raw audio blobs, full chapters, offline scripts) and `LocalStorage` (theme parameters, UI language).
*   **Volatile UI State:** Managed via React hooks (active playing chapter, loading indicators, visual sidebar expand state).

---

### 4. API Flow Sequence (Briefing Generation & Vocalization)

```
Client App             Express Backend           Gemini / TTS API
   |                          |                          |
   |-- 1. Trigger Brief ----> |                          |
   |   (Selected RSS Feeds)   |                          |
   |                          |-- 2. Fetch Feeds ------> |
   |                          |<- 3. Parse XML Feeds --- |
   |                          |                          |
   |                          |-- 4. Generate Script --> | (Gemini AI API)
   |                          |<- 5. Return JSON ------- |
   |                          |                          |
   |                          |-- 6. Request TTS Chunk ->| (Google Cloud / Edge TTS)
   |                          |<- 7. Return Audio Buffer |
   |                          |                          |
   |<- 8. Stream Audio & -----|                          |
   |      Script Chapters     |                          |
```

---

### 5. Service Layer Definitions

1.  **`broadcastSpeechEngine.ts`:** Controls audio pipelines. Connects to local audio cache; triggers playback, pauses, segment transitions, and integrates speech indicators.
2.  **`indexedDBQueue.ts`:** An offline storage engine. Saves synthesized MP3/PCM audio buffers into client-side IndexedDB databases, ensuring seamless performance during connection drops.
3.  **`syncService.ts` & `cloudSyncStatus.ts`:** Manage bidirectional sync between client database states and Supabase server clusters.
4.  **`rssService.ts`:** Standardizes RSS fetch processes. Normalizes various XML structures (Atom, RSS 2.0) into unified typescript models.
5.  **`schedulerService.ts`:** Manages automation. Registers client background checks to trigger daily morning digests pre-generation.

---

### 6. Storage Layer Layout

*   **Database Schema (Supabase / Postgres Core):**
    *   `profiles`: Contains UUIDs, names, and customized configurations.
    *   `rss_feeds`: List of user-curated feed configurations (ID, URL, Category, Icon, custom styling).
    *   `briefings_history`: Storage for generated scripts, payloads, chapters, and dynamic summaries.
*   **Local DB Schema (IndexedDB):**
    *   `audio_cache_store`: Maps chapter keys to local binary blobs (ArrayBuffers).
    *   `offline_queue`: An ordered list of audio tracks ready for commutes.
*   **Client Preferences (LocalStorage):**
    *   Theme configurations (`light` / `dark`).
    *   System UI Language (`en` / `vi`).
    *   Selected playback voice configurations.
