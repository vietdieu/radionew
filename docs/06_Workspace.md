# CommuteCast 3.0: AI Broadcast Studio
## Document 06: Unified Workspace Pipeline

This document defines the core user experience and architectural heart of the **AI Broadcast Studio**: the unified, sequential **Workspace Pipeline**. 

Rather than a fragmented, chaotic dashboard covered in dozens of disconnected "cards," CommuteCast 3.0 consolidates the entire content lifecycle into a highly focused, linear, 5-stage creation pipeline: **RSS Ingestion** ➔ **AI Structuring** ➔ **Script Refinement** ➔ **Voice Tuning** ➔ **Publish/Export**.

---

### 1. The Core Philosophy: "No Card Clutter"

Legacy systems clutter the user with secondary metrics, charts, and detached lists. The AI Broadcast Studio views the user as an executive producer of a professional daily audio digest. Every tool, view, and panel in the workspace must support moving a piece of raw content from its source state to a finalized spoken broadcast.

#### The 5-Stage Pipeline Stepper:
```
 [1. RSS Ingest] ──> [2. AI Structure] ──> [3. Script Edit] ──> [4. Voice Cast] ──> [5. Broadcast]
   (Crate Digging)     (Summarization)       (Dual-Host Script)    (Synthesizer Core)   (Export & Queue)
```

---

### 2. Deep Dive: The 5 Pipeline Stages

#### Stage 1: RSS Ingestion (The Ingestion Bay)
*   **Purpose:** Aggregate, triage, and filter.
*   **Visual Interface:** Split pane. 
    *   *Left list:* Categories and feeds (e.g., Tech, Politics, Business) with unread article counters.
    *   *Right grid:* Cards representing articles with title, source, publication time, and short preview snippets.
*   **Core User Action:** Interactive checklist selection. The user ticks articles they wish to bundle into their upcoming broadcast.
*   **Data Output:** A raw list of article payloads passed to the AI Engine.

#### Stage 2: AI Structuring (The Copilot Composer)
*   **Purpose:** Synthesize multiple articles into a cohesive narrative outline.
*   **Visual Interface:** Prominent layout showcasing selected articles on the left, and generation configuration on the right.
    *   *Tone Selectors:* Formal, Conversational, Dynamic, or Investigative.
    *   *Duration Targeting:* 3-minute brief, 5-minute update, 10-minute full episode.
    *   *Podcast Structure Preset:* Single narrator, Dual-host banter, panel discussion.
*   **Core User Action:** Click "Generate Base Script".
*   **Data Output:** A highly structured multi-host draft script formatted in JSON with distinct segment blocks and speaker turns.

#### Stage 3: Script Refinement (The Prompt Sandbox)
*   **Purpose:** Refine, expand, and annotate speech scripts manually or via prompt commands.
*   **Visual Interface:** Split screen.
    *   *Left Pane:* Raw article references with highlighters.
    *   *Right Pane:* Rich interactive script editor. The script is structured with conversational tags:
        ```text
        [Host A (Alex)]: Good morning and welcome back to your tech brief. Today we are looking at something revolutionary...
        [Host B (Sophia)]: That's right Alex. OpenAI just dropped a new model...
        ```
*   **Core User Action:** Direct inline script editing, adding transition headers, and using the "AI Rewriter" on selected blocks.
*   **Data Output:** A finalized, validated XML-like or JSON-formatted script containing explicit segment timings and speaker allocations.

#### Stage 4: Voice Tuning (The Synth Console)
*   **Purpose:** Cast voices, modulate pacing, and coordinate background sounds.
*   **Visual Interface:** Audio console layout.
    *   *Cast Selector:* Map voice actors (e.g., Google neural voices, Edge voices) to speakers (e.g., Host A, Host B, guest quote speakers).
    *   *Speech Modulation:* Fine-tune playback speed (pitch/tempo multipliers), emphasis parameters, and breath breaks.
    *   *Ambiance Mixer:* Control background volume for secondary music tracks (BGM), audio intros, transitions sound effects (SFX), and outros.
*   **Core User Action:** Audition short audio previews for individual script lines.
*   **Data Output:** A fully configured voice profile mapped directly to the finalized script segments.

#### Stage 5: Broadcast / Export (The Master Control Room)
*   **Purpose:** Compile, host, cache, and distribute.
*   **Visual Interface:** Success dashboard with detailed playback stats.
*   **Core User Actions:**
    *   **Publish to Podcast Feed:** Generate RSS XML, upload the synthesized audio chunks to persistent storage, and update public podcast directories.
    *   **Cache to Smart Play Queue:** Save the audio files into IndexedDB on the client's phone for seamless offline playing during commutes.
    *   **Download File:** Save the raw combined broadcast audio file locally.

---

### 3. State Mechanics & Transition Guards

To guarantee a clean workflow, the workspace maintains sequential locks. A stage is unlocked only when its prerequisite input data is populated:

```ts
interface WorkspaceState {
  currentStage: "INGEST" | "STRUCTURE" | "REFINEMENT" | "VOICE" | "EXPORT";
  selectedArticleIds: string[]; // Guard for INGEST -> STRUCTURE
  rawScriptDraft: ScriptJson | null; // Guard for STRUCTURE -> REFINEMENT
  finalizedScript: ScriptJson | null; // Guard for REFINEMENT -> VOICE
  voiceConfigMap: Record<string, VoiceSettings>; // Guard for VOICE -> EXPORT
  compiledAudioBlobUrl: string | null; // Product of EXPORT
}
```

#### Guards in Action:
1.  **Ingest to Structure Guard:** User must select at least one feed article or input a custom note. Otherwise, the "Generate Outline" option is disabled.
2.  **Structure to Refinement Guard:** The AI structuring prompt must resolve and validate successfully.
3.  **Refinement to Voice Guard:** Text segments must be allocated to valid active speakers.
4.  **Voice to Export Guard:** All speakers must have associated voice models selected.
