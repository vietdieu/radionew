# CommuteCast 3.0: AI Broadcast Studio
## Document 16: Performance, Optimization & Hydration Specification

This document details the engineering specifications, optimization strategies, and runtime constraints of **CommuteCast 3.0 (AI Broadcast Studio)**. To ensure a fluid 60fps experience, instant startup times, and optimal battery preservation on mobile commuting devices, we implement strict performance boundaries across the entire system.

---

### 1. Bundle Size & Code Splitting Strategy

A massive monolithic JavaScript bundle delays the initial Page Interactive metrics (TBT/FID). We employ dynamic code splitting via Vite and esbuild.

```
                    ┌──────────────────────────────┐
                    │      Vite Build Router       │
                    └──────────────┬───────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
 ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
 │  App Core    │          │  Studio views│          │  Audio Engine│
 │  (main, css) │          │ (lazy import)│          │ (lazy import)│
 └──────────────┘          └──────────────┘          └──────────────┘
```

#### A. Route-Level Code Splitting (React.lazy & Suspense)
*   **Implementation:** Rather than importing all views statically in `App.tsx`, we dynamically chunk major pages (RSS Studio, AI Script Editor, Audio Studio, Settings Panel).
*   **Code Pattern:**
    ```typescript
    import { lazy, Suspense } from "react";
    const RSSStudio = lazy(() => import("./pages/RSSStudio"));
    const AIStudio = lazy(() => import("./pages/AIStudio"));
    ```

#### B. Vendor Chunking (Vite Configuration)
*   Splits out heavy node_modules (such as `recharts`, `@google/genai`, `lucide-react`, and `motion`) into a distinct, long-term cached asset chunk (`vendor.js`). This guarantees that routine code edits to business logic do not invalidate the heavy third-party cached vendor bundle.

---

### 2. Memory Management & Audio Garbage Collection

Handling high-fidelity PCM/MP3 audio streams in memory can quickly trigger Out-Of-Memory (OOM) browser tab crashes, particularly on older mobile devices.

#### A. Buffer Release Lifecycles
*   **Automatic Cache Purging:** Once an audio chapter finishes playing, its raw binary `ArrayBuffer` state is immediately evicted from volatile React state, relying solely on stream-on-demand loaders from IndexedDB.
*   **Object URL Revocation:** Every temporary browser sound URL created via `URL.createObjectURL(blob)` is explicitly garbage collected via `URL.revokeObjectURL(url)` immediately after the media element finishes playing or gets skipped.

#### B. Active Audio Context Termination
*   When navigating away from the Audio Studio or turning off Driving HUD Mode, the active Web Audio `AudioContext` is completely suspended or closed (`audioCtx.close()`) to release hardware audio pipelines back to the host operating system.

---

### 3. CPU Optimization & Canvas Frame Throttling

The visualizers, waveform meters, and scrolling prompters require constant UI updates, which can cause frame drop and drain batteries if not optimized.

#### A. Throttled Canvas Rendering Loops
*   **RequestAnimationFrame (rAF):** Frequency bars and waveform progress pins are drawn strictly inside `requestAnimationFrame` loops.
*   **Frame Rate Limiting:** We limit visualizer updates to **30fps** instead of the browser's maximum 120Hz for high-refresh screens, reducing CPU cycles by 75% with imperceptible visual difference:
    ```typescript
    let lastRender = 0;
    function render(timestamp: number) {
      if (timestamp - lastRender < 33.3) { // limit to ~30fps
        requestAnimationFrame(render);
        return;
      }
      lastRender = timestamp;
      drawWaveform();
      requestAnimationFrame(render);
    }
    ```

#### B. Thread Offloading via Web Workers
*   **Task Delegation:** Heavy computation tasks—such as semantic deduplication calculations, XML parsing of massive RSS feeds, and phonetic string conversions—are offloaded to background Web Workers to keep the main UI thread free for touch interactions.

---

### 4. Network Optimization & Smart Media Chunking

We minimize bandwidth consumption to accommodate users riding through spotty mobile network regions.

*   **Deduplicated Pre-fetching:** The background synchronizer checks the `ETag` and `Last-Modified` headers of RSS feeds before downloading, avoiding unnecessary raw XML parsing if no new stories have been published.
*   **Audio Streaming Chunks:** The synthesis pipeline splits long broadcasts into individual chapter chunks (typically 1-2 minutes each). Instead of synthesizing a single 30-minute MP3 file, the server returns granular segments. The player streams and joins them in a gapless Web Audio node queue.

---

### 5. Hydration & Safe Client-Side Initialization

To prevent visual flickering, double layout-shifts, and UI mismatches during hydration in server-rendered or pre-rendered modes, we enforce strict guidelines:

*   **State Hydration Guards:** Components accessing `localStorage`, system audio APIs, or `navigator` parameters wait until the mounting phase completes before initializing, preventing server-client markup disparities:
    ```typescript
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);
    if (!isMounted) return <SkeletonLoader />;
    ```
*   **Skeleton Loader Placeholders:** Replaces generic spinners with layout-matching grey boxes to preserve layout height constraints, completely eliminating cumulative layout shifts (CLS).

---

### 6. High-Performance Virtual Scroll List Windowing

When a user subscribes to dozens of active feeds, the aggregated article list can easily scale to thousands of items. Rendering 1,000+ complex DOM nodes will slow down scrolling.

```
 [ Visible Area (Viewport) ]   ──> Only renders active visible rows (e.g., Row 4-10)
                                    Injects tiny top/bottom padding offsets to preserve scroll position
 [ Invisible Buffer Area ]     ──> Unrendered, pure data in React memory
```

*   **Virtual Windowing Algorithm:** On lists exceeding 50 items (e.g., RSS Ingestion grid, History cards), we implement virtual lists.
*   **DOM Node Capping:** We render exactly the elements currently visible in the user's viewport plus a buffer of 5 items above and below.
*   **Performance Impact:** Caps total active list DOM nodes to under 20, resulting in a **95% reduction in DOM complexity** and completely smooth, stutter-free scrolling on mobile devices.
