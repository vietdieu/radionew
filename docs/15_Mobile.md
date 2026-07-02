# CommuteCast 3.0: AI Broadcast Studio
## Document 15: Mobile Layout & Bottom Navigation Specification

This document details the mobile-specific user interface, touch interactions, layout rules, and navigation architectures of **CommuteCast 3.0 (AI Broadcast Studio)** for iOS and Android platforms. 

To satisfy the ergonomics of single-handed operation on mobile devices, we completely abandon the desktop-oriented Sidebar navigation on smaller screens. Instead, we transition to a thumb-optimized **Bottom Navigation Bar** conforming to Material Design 3 and Apple Human Interface Guidelines.

---

### 1. The Mobile Layout Paradigm: "Thumb-First" Ergonomics

On desktop layouts (break-point `md` and above), CommuteCast utilizes a spacious left-aligned Sidebar. On mobile viewports (below `md`), the sidebar is completely hidden. All primary workspace links are mapped to a bottom navigation rail located within the direct sweep of the user's thumb.

```
 +-------------------------------------------------------+
 |  [Topbar: Brand Logo]                     [Sync] [User]|
 |-------------------------------------------------------|
 |                                                       |
 |                                                       |
 |              [ Mobile Workspace Canvas ]              |
 |         (RSS, Script, Audio Studio or Player)         |
 |                                                       |
 |                                                       |
 |                                                       |
 |-------------------------------------------------------|
 |          [ Sticky Mini-Player Controls ]              |
 |      "Alex & Sophia Tech Brief"   [PLAY] [NEXT]       |
 |-------------------------------------------------------|
 |  [Home]    [Studio]    [Scripts]    [Queue]   [Settings] |
 |   (Tab)     (Tab)       (Tab)        (Tab)      (Tab)  |
 +-------------------------------------------------------+
```

---

### 2. Tab Navigation Architecture

The Bottom Navigation Bar features exactly five high-value touch targets, maintaining consistent screen space and visual clarity:

1.  **Home (Dashboard):** Quick summary of the day, transit/commute timer cards, and the big "Launch Drive HUD" trigger.
2.  **Studio (RSS Ingest):** High-density lists optimized for swiping and checking articles to compile.
3.  **Scripts (AI Writer):** View and prompt-edit synthesized drafts, tailored with responsive sheet drawers.
4.  **Queue (Offline Playlist):** Rearrange offline briefings, track storage limits, and manage processing jobs.
5.  **Settings (Config tabs):** Grouped profile settings optimized with custom horizontal slider panels instead of standard deep scrolls.

---

### 3. Touch target & Interaction Specifications

To ensure accuracy while walking, standing on a subway, or preparing for a drive, we enforce strict tactile metrics:

*   **Touch Target Minimum Sizing:** Every button, tab, and toggle on mobile is sized to a minimum of **48px x 48px** to eliminate misclicks and accommodate diverse thumb sizes.
*   **Safe Area Padding (OS Integration):**
    *   *iOS:* Respects the `safe-area-inset-bottom` parameter, adding padding beneath the bottom navigation bar to avoid overlay clashes with the iOS Home indicator line.
    *   *Android:* Incorporates system navigation bar margins, preventing overlapping with the system three-button or gesture navigation pills.
*   **Active Tab States:** Active navigation tabs employ distinct high-contrast color indicators (e.g. Indigo or Deep Violet glow) paired with subtle, spring-driven bounce transitions on the icon itself.

---

### 4. Interactive Mobile Gestures

To augment the lack of desktop drag-and-drop systems, we replace complex pointer events with mobile-native swipe gestures:

*   **Swipe to Remove (Queue List):** Swiping a briefing track to the left exposes a high-contrast red "Delete" action panel.
*   **Swipe to Fast-Add (RSS Studio):** Swiping an article card to the right automatically enqueues it for compilation, displaying a floating "Enqueued" chip.
*   **Interactive Pull-To-Refresh:** Dragging down from the top of the RSS view triggers an elastic loading chime, prompting the backend Express proxy to parse the newest feed updates.

---

### 5. Unified Responsive Navigation Hook (React Code Pattern)

To coordinate these layout transitions seamlessly in code without duplicating logic, we utilize responsive viewport match hooks:

```typescript
import { useState, useEffect } from "react";

export function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    setIsMobile(mediaQuery.matches);

    const handleResize = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    mediaQuery.addEventListener("change", handleResize);
    return () => mediaQuery.removeEventListener("change", handleResize);
  }, []);

  return isMobile;
}
```

#### Render Strategy inside App Router:
*   `if (isMobile) { renderBottomNavigation(); }`
*   `else { renderGlobalSidebar(); }`
