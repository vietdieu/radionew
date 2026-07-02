# CommuteCast 3.0: AI Broadcast Studio
## Document 11: Playback Studio Specification

This document details the user experience, controls, and technical specifications for the **Playback Studio** inside **CommuteCast 3.0 (AI Broadcast Studio)**. Styled like Spotify, this module is built to provide an immersive, tactile, and highly responsive audio player capable of managing complex playlist queues, rendering real-time waveforms, seeking, skipping, bookmarking key segments, and adjusting playback speeds.

---

### 1. Visual Layout: The Spotify of Spoken Content

The Playback Studio utilizes a premium, high-contrast, distraction-free player interface. It features a sticky bottom controller for global app states, a full-screen expanded commuter hub, and a side-docked interactive playlist queue panel.

```
 +-----------------------------------------------------------------------------------+
 |  PLAYBACK STUDIO  |  [Active Chapter: Tech News Update]               [Bookmark]  |
 |-------------------+---------------------------------------------------------------|
 |                                                                                   |
 |                             [ === GRAPHIC WAVEFORM === ]                          |
 |                   _ _||_ _ _ _||||_ _ _ _||_ _ _ _||||_ _ _ _ _                   |
 |                   | |  | | | | |  | | | | |  | | | | |  | | | |                   |
 |                                                                                   |
 |                         01:45 ─────────────●────────────────── 05:00              |
 |                                                                                   |
 |                   [Shuffle]  [Back 15s]  [PLAY/PAUSE]  [Skip 15s]  [Repeat]       |
 |                                                                                   |
 |  [Queue Dock]                                                                     |
 |  - Chapter 1: Introduction & Teasers (0:45)                                       |
 |  - Chapter 2: The M4 Silicon Breakthrough (2:15)      <-- ACTIVE                  |
 |  - Chapter 3: Global Ocean Explorations (1:30)                                    |
 |  - Chapter 4: Traffic & Morning Wrap (0:30)                                       |
 +-----------------------------------------------------------------------------------+
```

---

### 2. Core Functional Specifications

#### A. Interactive Play Queue Manager
*   **Gapless Transitions:** Audio tracks (chapters) are pre-loaded in the background. As Chapter 1 finishes, Chapter 2 begins instantly without clicks, pauses, or buffering delays.
*   **Drag-and-Drop Reordering:** Interactive queue list allows users to re-order the broadcast chapters on the fly, dynamically updating the master audio segment sequence.
*   **Auto-Play Next:** When the current compiled briefing ends, the player automatically transitions to the next briefing in the queue or plays custom saved music.

#### B. Dynamic Audio Waveform Rendering
*   **Pre-generated Waveforms:** Generates a complete SVG or canvas-based waveform visualization by pre-analyzing the audio buffer peaks.
*   **Real-time Canvas Visualizer:** Utilizes `AnalyserNode` from the Web Audio API to paint dynamic, glowing, high-contrast frequency spectrum bars during live playback.
*   **Click-to-Seek Canvas:** Clicking on any coordinate of the waveform jumps the audio pointer directly to that precise timeline offset.

#### C. Smart Seeking & Precision Controls
*   **Progress Scrubbing:** Smooth, anti-lag timeline scrubbing using customized touch-friendly range sliders.
*   **Tactile Skip Triggers:** Dedicated 15-second skip forward (`Skip 15s`) and 15-second skip backward (`Back 15s`) buttons, mapped to physical keyboard keys (Left/Right arrows) or media session events.
*   **Chapter Jump buttons:** Quickly skip entire chapters or articles using Next/Previous track actions.

#### D. Interactive Bookmarking Engine
*   **Spoken Markers:** Allows users to bookmark specific timecodes or phrases inside the audio. Double-clicking the "Bookmark" button triggers a high-priority tag.
*   **AI Context Clipping:** Bookmarking a section automatically clips the associated text block from the script editor, saving it to "Saved Snippets" with options to translate, share via email, or sync to personal Notion databases.

#### E. Speech-Optimized Playback Speed
*   **Pitch-Compensated Stretching:** Adjusts playback speeds between **0.5x** and **3.0x** with granular increments (0.1x steps).
*   **Vocal Intelligibility Algorithm:** Employs the browser’s `playbackRate` alongside custom frequency-stretching algorithms to ensure voices do not sound cartoonishly high-pitched or slowed down, preserving crisp vocal clarity even at 2x speed.

---

### 3. MediaSession API Integration

To provide a native mobile-like experience, the playback studio registers custom listeners on the host operating system, enabling control from locked phone screens, smartwatch widgets, or car dashboard steering wheel buttons.

```typescript
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Morning Tech Briefing',
    artist: 'CommuteCast Studio',
    album: 'Daily Briefings',
    artwork: [
      { src: '/assets/logo-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/assets/logo-512.png', sizes: '512x512', type: 'image/png' }
    ]
  });

  navigator.mediaSession.setActionHandler('play', () => audioEngine.play());
  navigator.mediaSession.setActionHandler('pause', () => audioEngine.pause());
  navigator.mediaSession.setActionHandler('seekbackward', (details) => audioEngine.seekRelative(-15));
  navigator.mediaSession.setActionHandler('seekforward', (details) => audioEngine.seekRelative(15));
  navigator.mediaSession.setActionHandler('previoustrack', () => queue.playPreviousChapter());
  navigator.mediaSession.setActionHandler('nexttrack', () => queue.playNextChapter());
}
```
