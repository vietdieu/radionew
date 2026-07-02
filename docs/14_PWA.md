# CommuteCast 3.0: AI Broadcast Studio
## Document 14: PWA, Offline & Background Sync Specification

This document details the progressive web application (PWA) capabilities, service worker strategies, offline caching, and notification pipelines of **CommuteCast 3.0 (AI Broadcast Studio)**. 

To satisfy the demanding requirements of commuting professionals who transit through underground tunnels, high-speed rail lines, and cell-signal deadzones, the platform is engineered with a strict offline-first execution model utilizing PWAs, service workers, background synchronization, and push notifications.

---

### 1. PWA Manifest & App Installation

The platform exposes a standard manifest profile (`public/manifest.json`) enabling users to install CommuteCast as a native application on Android, iOS, and desktop environments.

*   **App Presentation Mode:** Runs in `standalone` display mode, hiding browser navigation bars, URL cards, and back/forward buttons to mimic a native mobile OS application.
*   **Orientation Lock:** Forced portrait mode on mobile viewports, automatically unlocking to horizontal canvas orientation when "Driving HUD Mode" is active.
*   **App Shortcuts:** Registers immediate shortcut routes to bypass landing screens, launching straight into:
    *   `/studio/rss` (Direct Ingestion)
    *   `/player/hud` (Driving Mode Player)
*   **Asset Bundling:** Features splash screens and launcher icons configured for diverse pixel densities (192px, 512px, Apple Touch Icons).

---

### 2. Service Worker & Progressive Caching Strategy

The core offline engine is driven by a custom service worker (`/sw.js`) that acts as an intelligent network proxy between the browser client and external servers.

```
                  ┌──────────────────────────────┐
                  │      CommuteCast PWA UI      │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │    Service Worker Proxy      │
                  │                              │
                  │   Cache-First (Static Assets)│
                  │   Network-First (Feeds API)  │
                  └──────────────┬───────────────┘
                                 ├──────────────────────────────┐
                                 │ (Cache Hit)                  │ (Cache Miss)
                                 ▼                              ▼
                  ┌──────────────────────────────┐ ┌──────────────────────────────┐
                  │    Service Worker Cache      │ │      External Internet       │
                  │      (IndexDB / CacheStorage)│ │      (Vite Dev / Supabase)  │
                  └──────────────────────────────┘ └──────────────────────────────┘
```

#### A. Cache-First Strategy (Static Shell)
*   **Target Assets:** Pre-caches all HTML, JS bundles, CSS sheets, font sheets (Inter & Space Grotesk), system icons, and layout graphics.
*   **Outcome:** The application interface loads instantly (< 100ms) on subsequent launches, even with zero network connectivity.

#### B. Network-First with Stale-While-Revalidate (Feeds & Metadata)
*   **Target Assets:** API responses for RSS feeds and profile settings.
*   **Outcome:** The app always attempts to fetch the newest articles first. If the internet fails, it falls back to the last successfully synced articles stored in the local IndexedDB, displaying an "Offline Mode" warning badge.

#### C. Cache-Only Strategy (Audio Broadcasts)
*   **Target Assets:** Raw audio MP3/PCM chunks synthesized via TTS.
*   **Outcome:** Synthesized briefings are saved directly into IndexedDB storage. The player streams speech files from this local database rather than requesting network buffers, guaranteeing continuous, gapless audio playback in tunnels.

---

### 3. Background Sync & Pre-Compilation Pipelines

To ensure briefings are compiled and cached *before* the user leaves their house, CommuteCast utilizes the **Background Sync API** and **Periodic Background Sync API**.

```typescript
// Registering Periodic Background Sync for Daily Briefs
async function registerDailyBriefingFetch() {
  const registration = await navigator.serviceWorker.ready;
  if ('periodicSync' in registration) {
    try {
      await registration.periodicSync.register('morning-brief-sync', {
        minInterval: 24 * 60 * 60 * 1000, // Trigger once every 24 hours
      });
      console.log('Daily morning sync registered successfully!');
    } catch (error) {
      console.error('Periodic sync registration failed:', error);
    }
  }
}
```

*   **The Morning routine:**
    1.  At 5:30 AM, while the phone is connected to home Wi-Fi and charging, the mobile OS wakes the service worker.
    2.  The service worker fetches the user's selected RSS feed categories.
    3.  It makes background calls to the Express server `/api/rss` to parse and clusters stories.
    4.  It sends the text blocks to the Gemini API `/api/script` to draft the spoken script.
    5.  It synthesizes the speech chapters via the `/api/tts` proxy and stores the resulting audio blocks into the client's `IndexedDB`.
    6.  The daily briefing is fully compiled and cached before the user wakes up.

---

### 4. Interactive Local Push Notifications

To coordinate with background processing, the Service Worker triggers rich operating system notifications:

```typescript
// Notification Triggered Upon Background Compilation Success
self.registration.showNotification('Your Commute Briefing is Ready!', {
  body: 'Alex & Sophia have compiled a 6-minute tech & weather update for your drive.',
  icon: '/assets/logo-192.png',
  badge: '/assets/badge-96.png',
  vibrate: [200, 100, 200],
  tag: 'morning-brief-ready',
  actions: [
    { action: 'play', title: 'Start Playing Now', icon: '/assets/icons/play.png' },
    { action: 'open_hud', title: 'Open Driving HUD', icon: '/assets/icons/hud.png' }
  ]
});
```

*   **Interactive Notification Handles:**
    *   *Clicking the Notification:* Launches the PWA straight into the full-screen player.
    *   *Clicking 'Start Playing':* Instantly starts the audio playback stream in the background without needing to unlock the phone.

---

### 5. Install Prompt UX flow

The application implements a friendly, non-intrusive install experience to maximize app adoption:
*   **Deferred Install Prompt:** Intercepts the default browser installation event (`beforeinstallprompt`) and stores it locally.
*   **Contextual Install Banners:** Prompts the user to "Install CommuteCast to home screen for offline commuting" in high-value zones (e.g., inside the Settings Center or when first configuring the "Driving HUD").
