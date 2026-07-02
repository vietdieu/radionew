# CommuteCast 3.0: AI Broadcast Studio
## Document 13: Settings Center Specification

This document details the layout, configuration categories, and data schema of the **Settings Center** in **CommuteCast 3.0 (AI Broadcast Studio)**. 

To prevent user fatigue and avoid long, intimidating scroll pages (e.g., a "2000px vertical scroll page"), the Settings Center is designed as a **modular, multi-tab layout with vertical/horizontal sub-navigation**, grouping configuration keys into discrete, highly contextual panels.

---

### 1. Tabbed Navigation Grid

The Settings Center workspace is divided into eight major categories, accessed via a responsive sidebar or horizontal menu:

```
 +-----------------------------------------------------------------------------------+
 |  SETTINGS CENTER | [General] [Audio] [AI] [RSS] [Storage] [Accessibility] [Privacy] [Dev] |
 |------------------+----------------------------------------------------------------|
 |                                                                                   |
 |  [AI SETTINGS]                                                                    |
 |                                                                                   |
 |  * Primary Language model:  [ Gemini 2.5 Flash   v ]                              |
 |  * Default Studio Tone:     [ Morning Coffee     v ]                              |
 |  * User Bio Memory:         [ "Focus on artificial intelligence and space..." ]  |
 |                                                                                   |
 |  [ Save Changes ]                                              [ Reset Defaults ] |
 +-----------------------------------------------------------------------------------+
```

---

### 2. Tabbed Panel Breakdown

#### Tab 1: General Settings (System Core)
*   **Localization:** Select UI Language (English, Vietnamese, Spanish, etc.) and time zone settings.
*   **Startup Preferences:** Choose the default launch view (Dashboard, RSS Studio, or last active screen).
*   **PWA Auto-Launch:** Options to launch CommuteCast automatically when the device boots (highly useful for mobile dedicated displays).

#### Tab 2: Audio Settings (DAW Parameters)
*   **Synthesis Engine Defaults:** Select default speech provider (Google Cloud Text-to-Speech vs. Edge Neural voices).
*   **Global Voice Cast Map:** Configure which default AI speakers are assigned to specific roles (e.g., Narrator, Host A, Host B, Guest interviewer).
*   **Master Audio FX Presets:** Toggle default mastering parameters like Auto-Compressor, Limiter, and select default Graphic Equalizer curves (Warm Podcast, Crisp Presence, or Flat Vocal).
*   **Auto-Ducking Level:** Slider to adjust background music (BGM) attenuation strength (e.g. ducking to -18dB vs. -12dB).

#### Tab 3: AI Configuration & Memory Studio
*   **Model Selection:** Choose active Gemini model targets (Gemini 2.5 Flash for speed, Gemini 2.5 Pro for deep multi-source research).
*   **Custom Prompting Templates:** Manage custom segment prompts and edit default templates.
*   **System Rules & Memory Profile:** Structured text area containing user-defined restrictions (e.g., "Exclude cryptocurrency news", "Prioritize biomedical research").
*   **Phonetic Pronunciation Lexicons:** Editable table where users map words to their phonetic spelling overrides to force consistent TTS pronunciation.

#### Tab 4: RSS & Ingest Preferences
*   **Deduplication Strength:** Slider setting similarity thresholds for clustering matching stories (Loose, Medium, Strict).
*   **Keyword Filters & Exclusions:** Global list of blacklisted tags, authors, or key terms (Regex supported).
*   **Auto-Fetch Cadence:** Define how often the background service checks for RSS updates (e.g., every 1 hour, every 6 hours, once per day at 5:00 AM).

#### Tab 5: Local Storage & Caching Database
*   **Database Statistics:** Real-time visual pie chart mapping device storage usage (Audio cache vs. Text logs vs. System state).
*   **Cache Retention Policies:** Define when old briefings should be pruned automatically (e.g., keep the last 5 briefs, or delete files older than 3 days).
*   **Manual Purge Deck:** Action buttons to:
    *   `Clear Audio Cache`: Deletes offline audio files without wiping feed choices.
    *   `Flush Local Database`: Resets the entire client-side IndexedDB database.
    *   `Export Backup File`: Downloads a JSON file containing all feeds, settings, and histories.

#### Tab 6: Accessibility Settings (Hands-Free HUD)
*   **Driving HUD Contrast Controls:** Toggle High-Contrast interface mode (optimized for low-light or direct-sunlight driving).
*   **Universal Font Sizing:** Slider to scale system fonts, especially helpful inside the Script Editor and prompter views.
*   **Voice Control & Transcription:** Enable voice search, voice command listening, and live caption rendering during playback.

#### Tab 7: Privacy & Cloud Synchronizations
*   **Telemetry Opt-in:** Toggle sharing anonymous app crash telemetry logs.
*   **Supabase Synchronization:** Link user account to cloud servers, encrypting personal feeds and preferences during transit.
*   **Offline Mode Enforcements:** Force the application to rely exclusively on local local storage and local audio, bypassing cloud analytics completely.

#### Tab 8: Developer Sandbox & System Logs
*   **API Credentials Console:** Inputs for custom API Keys (Gemini API key, Google Cloud TTS, or Supabase custom URLs).
*   **Live Console Logs:** Real-time, scrolling monospaced terminal displaying diagnostic events (e.g., API requests, service worker states, DB operations).
*   **JSON Schema Inspector:** Direct viewer for active Workspace payloads and job configurations.

---

### 3. Settings Configuration Schema

All settings are encapsulated in a single, strictly typed global structure stored in `LocalStorage` (and synced to Supabase when active):

```typescript
export interface AppSettings {
  general: {
    language: "en" | "vi";
    defaultView: "dashboard" | "rss_studio" | "audio_studio";
  };
  audio: {
    defaultProvider: "google" | "edge";
    fxPreset: "warm_podcast" | "crisp_presence" | "flat";
    bgmEnabled: boolean;
    bgmTrackId: string;
    bgmVolume: number;
    duckingDb: number;
  };
  ai: {
    model: "gemini-2.5-flash" | "gemini-2.5-pro";
    userMemoryProfile: string;
    pronunciationOverrides: Record<string, string>;
  };
  rss: {
    deduplicationThreshold: number; // 0.0 to 1.0
    excludeKeywords: string[];
    autoSyncIntervalMinutes: number;
  };
  storage: {
    maxCacheAgeDays: number;
    maxCacheSizeMb: number;
  };
  accessibility: {
    hudHighContrast: boolean;
    fontSizeMultiplier: number; // e.g. 1.2
    voiceCommandsEnabled: boolean;
  };
}
```
