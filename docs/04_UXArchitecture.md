# CommuteCast 3.0: AI Broadcast Studio
## Document 04: UX Architecture

This document maps out the User Experience (UX) Architecture and Navigation systems of **CommuteCast 3.0 (AI Broadcast Studio)**, defining how content aggregates, synthesizes, and outputs via an immersive Workspace console.

---

### 1. Unified Information Architecture (IA)

```
[Main Entry Canvas (App Dashboard)]
   |
   |-- [Sidebar (Global Navigation)]
   |     |-- RSS Studio (Ingest sources, customize priorities)
   |     |-- AI Script Editor (Convert, rewrite, edit broadcast)
   |     |-- Audio Studio (Configure voices, background ambiance, preview)
   |     |-- Smart Queue (Drag-and-drop playlist, offline assets status)
   |     +-- System Settings (Preferences, profile sync, database maintenance)
   |
   |-- [Topbar (Contextual Command Bar)]
   |     |-- Quick Search & Filter Panel
   |     |-- Connection Status Indicator (Supabase / Offline Mode)
   |     |-- Theme Control (Light/Dark toggles)
   |     +-- Current User Profile
   |
   |-- [Primary Focus Workspace (Contextual App Panels)]
   |     |-- Dashboard Panel (Welcome stats, daily briefing card, quick-start button)
   |     |-- Multi-Pane Studio Console (Source Feed list + Interactive editor pane)
   |     +-- Commuter Driving Console (HUD optimized for touch targets)
   |
   +-- [Global Audio Controller (Sticky HUD)]
         |-- Audio Waveform and Time Tracker
         |-- Master Control Panel (Play, Pause, Skip, Voice Config dropdown)
         +-- Smart Queue drawer
```

---

### 2. Main Window Shell & Workspace Layout

The interface is structured as a full-bleed, responsive grid layout, prioritizing desktop multitasking while adapting seamlessly to tablets and touch devices.

```
+-----------------------------------------------------------------------------------+
|  [Sidebar] |  Topbar:  [Search...]                 [Supabase State]  [User Profile] |
|            |----------------------------------------------------------------------|
|  * Home    |  [Breadcrumbs: RSS Studio > Tech Feed]                               |
|  * Feeds   |----------------------------------------------------------------------|
|  * Scripts |  [Workspace Left: Feed Panel]      |  [Workspace Right: Script Pane] |
|  * Audio   |                                    |                                 |
|  * Queue   |  - TechCrunch (2 unread)           |  **Title: Tech Broadcast**      |
|  * Setting |  - HN Top (5 unread)               |  "In today's technology briefing..."|
|            |  - Wired News (1 unread)           |                                 |
|            |                                    |  [Generate Audio]  [Save Script]|
|------------+------------------------------------+---------------------------------|
|            |  [Sticky Audio Controller]                                          |
|  [Status]  |  << (Prev)  || (Pause)  >> (Next)  [=========------------] 01:24/05:00 |
+-----------------------------------------------------------------------------------+
```

---

### 3. Responsive Navigation Mechanics

#### A. The Global Sidebar
*   **Behavior:** Stationary and wide on desktop (`w-64`). Translates into a collapsed icon ribbon on tablet size (`w-20`). Concealed entirely behind a hamburger menu button on mobile layouts, pulling open as a slide-out overlay.
*   **State Control:** Maintained via a persistent React boolean state, which stores preference in localStorage for consistent layouts between user sessions.

#### B. Breadcrumb Hierarchy
*   **Location:** Top of the primary Workspace view.
*   **Format:** Dynamic mapping of the current router location (e.g. `Dashboard / RSS Studio / TechCrunch Feed`). Every breadcrumb link is clickable, offering clear orientation for complex workspace levels.

#### C. Topbar Action Bar
*   **Quick Search Control:** Triggers an overlay command palette with a hotkey shortcut (`CMD/CTRL + K`). 
*   **Sync Telemetry Display:** High-contrast indicator tracking if preferences are synced to the Cloud or cached securely in LocalStorage.

---

### 4. Interactive Workspace Panel States

The user interfaces split into distinct focus panels tailored to the active process:

1.  **Preparation Mode (RSS Studio):** High-density list layout. Filter by categories, bulk-select articles, drag-and-drop feed order. Focus is on *speed and triage*.
2.  **Creation Mode (AI Studio & Script Editor):** Multi-pane split screen. Left side contains references and article digests; right side contains the interactive script editor. Focus is on *focus and utility*.
3.  **Audition Mode (Audio Studio):** Audio dashboard showing dynamic voice waveforms, host selectors, background music sliders, and segment preview triggers. Focus is on *auditory verification*.
4.  **Commuter Mode (Driving HUD):** Zero-distraction interface. Strips away the sidebar and text-heavy panels, expanding the player container to take up the full screen with huge button targets, high contrast, and large captions.

---

### 5. Quick Search Command Palette (CMD + K)

A global search overlay designed to jump to any section, feed, archived script, or action within the system without using the mouse.

*   **Structure:**
    *   **Section 1: Search Inputs** (Debounced search bar fetching matching articles, RSS posts, or Saved Briefings).
    *   **Section 2: Commands** (e.g., "> Compile Morning Brief", "> Switch to Driving Mode", "> Clear Cache").
    *   **Section 3: Recent Items** (Quick access to recently opened audio briefs or active feeds).
*   **Animations:** Elegant fade-in with a subtle downward slide using transition presets.
