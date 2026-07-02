# CommuteCast 3.0: AI Broadcast Studio
## Document 12: Queue Manager & Processing Pipeline

This document details the architecture, state transitions, scheduling, and error handling of the **Queue Manager & Processing Pipeline** in **CommuteCast 3.0 (AI Broadcast Studio)**. 

To ensure continuous, offline-first execution during transit (especially when traversing weak signal areas like subways, tunnels, or highways), the platform employs a high-performance, background-capable task queue built on **IndexedDB** paired with service worker executors.

---

### 1. Ingestion & Processing Pipeline Architecture

Unlike naive queues that download media sequentially, our Queue Manager utilizes a **Multi-Stage Priority Processing Engine** that coordinates background tasks for feed fetching, script synthesis, audio rendering, and cache management.

```
       [ New Briefing Request ] (High Priority / Manual Sync)
                  │
                  ├──> [ Enqueue in Priority Database (IndexedDB) ]
                  │
                  ▼
       [ Job Scheduler Loop ] ────> Triggers Service Worker in background
                  │
                  ├──> [ Stage 1: INGEST_FETCH ] (XML Parse & Readability)
                  ├──> [ Stage 2: SCRIPT_GENERATE ] (Gemini API Script drafting)
                  ├──> [ Stage 3: AUDIO_SYNTHESIZE ] (Voice rendering chunks)
                  ├──> [ Stage 4: CACHE_ASSEMBLY ] (Loudness normalization & packaging)
                  │
                  ▼
       [ Success: Enqueued to Local Offline Playlist ]
       [ Failure: Moved to Retries or Failed Jobs log ]
```

---

### 2. Core Queue Specifications

#### A. Multi-Level Priority Queue Routing
The processing engine classifies jobs into three explicit priority streams to maximize CPU efficiency and prevent network starvation:
1.  **Immediate (High Priority):** Manual actions triggered by the active user (e.g., clicking "Regenerate this Paragraph" or "Create morning brief now"). These bypass all scheduled items and preempt active background tasks.
2.  **Scheduled (Medium Priority):** Automation-driven briefs (e.g., the Daily Commuter morning digest scheduled to build at 6:00 AM).
3.  **Maintenance (Low Priority):** Background tasks (e.g., purging cached audio files older than 7 days, pre-fetching article body texts, and backing up user profiles).

#### B. Resilient Background Job Workers
*   **Service Worker Integration:** Executes tasks in a distinct background thread. The processor continues fetching and rendering briefings even if the user closes their web app tab, locks their phone, or turns off the screen.
*   **Concurrency Controls:** Restricts background jobs to a maximum of **2 parallel worker tasks** on mobile devices (to preserve battery and memory) and **4 parallel worker tasks** on desktop browsers.

#### C. Intelligent Retry & Backoff Engine
Network connections during a commute are notoriously unpredictable. The queue manager implements an **Exponential Backoff and Retry Policy**:
*   *Maximum Retries:* **3 times** per processing stage.
*   *Backoff Interval:* $Delay = InitialDelay \times 2^{Attempt} + Jitter$. This prevents server spam (thundering herd problem) while maximizing recovery chances during transient network dropouts.
*   *Network Guard:* Automatically pauses the queue processor when the browser reports `navigator.onLine === false` and resumes instantly when a stable connection is re-established.

#### D. Failed Jobs Telemetry & Debug Deck
*   **Failed Queue Log:** Displays a list of tasks that exceeded the maximum retry limit, showing the exact step that failed (e.g., "Script compilation failed: API Key invalid" or "Vocal synthesis failed: HTTP 504 Gateway Timeout").
*   **Manual Override Tools:**
    *   `Force Retry`: Re-inserts a failed job back into the high-priority queue with its cached state preserved (preventing the need to re-fetch identical RSS data).
    *   `Skip Step`: Allows bypassing a failed voice block synthesis, substituting standard browser TTS in real-time.
    *   `Flush Queue`: Clears out stuck or broken jobs from the IndexedDB memory stack.

#### E. Detailed Execution History Logs
*   **Performance Metrics:** Tracks preparation performance (e.g., "Compiling 5-minute briefing took 12.4 seconds").
*   **Space Management Analytics:** Monitors local device storage footprint, alerting users when offline audio cache nears storage capacity limits, with automatic oldest-briefing pruning.

---

### 3. Database Schema for Jobs (IndexedDB)

The local job database is structured around the following robust Typescript schemas:

```typescript
export enum JobStage {
  INGEST_FETCH = "INGEST_FETCH",
  SCRIPT_GENERATE = "SCRIPT_GENERATE",
  AUDIO_SYNTHESIZE = "AUDIO_SYNTHESIZE",
  CACHE_ASSEMBLY = "CACHE_ASSEMBLY",
  COMPLETE = "COMPLETE",
  FAILED = "FAILED"
}

export interface ProcessingJob {
  id: string; // Unique UUID
  briefingId: string; // Parent briefing document
  title: string; // Friendly name for UI logs
  priority: "high" | "medium" | "low";
  stage: JobStage;
  retryCount: number;
  maxRetries: number;
  lastAttemptTimestamp: number;
  errorMessage?: string;
  payload: {
    selectedFeedUrls: string[];
    toneProfile: string;
    scriptId?: string;
    audioChunkKeys?: string[];
  };
}
```
