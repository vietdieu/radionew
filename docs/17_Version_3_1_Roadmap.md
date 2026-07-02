# CommuteCast 3.1: AI Broadcast Studio
## Document 17: Version 3.1 Engineering Roadmap

This document outlines the evolutionary development stages of **CommuteCast 3.1 (AI Broadcast Studio)**. We transition the platform through structured development phases (Sprints) focusing on stability, interface excellence, and audio fidelity.

---

### 1. The 3.1 Agile Release Plan

```
 [ Sprint 0: Foundation ]  ──> [ Sprint 1: RSS Studio ]  ──> [ Sprint 2: AI Studio ]
       (COMPLETE)                      (Planned)                    (Planned)
                                                                        │
 [ Release Candidate ]     <── [ Sprint 5: Polish ]   <── [ Sprint 3 & 4: Audio/Queue ]
       (Planned)                       (Planned)                    (Planned)
```

| Phase | Sprint Name | Primary Objective | Scope Definition | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Sprint 0** | **Foundation** | Standardize foundation, naming, structure | No new features. No UI changes. Align code layout with official Design tokens. | **COMPLETE** |
| **Sprint 1** | **RSS Studio** | Elevate stream curation | Enhance RSS discovery, filter customization, and feed-to-brief parsing efficiency. | *Planned* |
| **Sprint 2** | **AI Studio** | Upgrade conversational scripting | Advanced Gemini-powered drafting, multi-host dynamic interactions, voice memory. | *Planned* |
| **Sprint 3** | **Audio Studio** | Refine voice synthesis pipeline | Integrate vocal parameters (intonation, emotion), custom pronunciation, EQ. | *Planned* |
| **Sprint 4** | **Queue & Playback** | Mobile PWA & Spotify-like UI | Bottom-navigation responsive layout, smooth seeking, background sync. | *Planned* |
| **Sprint 5** | **Professional Polish**| Micro-interactions & animations | High-contrast visualizer HUD, key gestures, keyboard shortcut mappings. | *Planned* |

---

### 2. Sprint 0 (Foundation) Achievement Sheet

Our absolute priority in Sprint 0 was **stabilizing, organizing, and standardizing** without introducing new functional dependencies or altering current user experiences.

#### A. Folder Layout Standardization
We verified and structured the code architecture into clean, modular directory segments to ensure robust separation of concerns:
*   `src/components/` - Shared UI buttons, modal frames, profiles, and list components.
*   `src/features/` - Domain-specific capsules (Download managers, Keyboard mapping hooks, Settings Center, Storage metrics).
*   `src/services/` - Isolated background utilities (Web Audio TTS engines, Offline database controllers, RSS parsers, Supabase clients).
*   `src/hooks/` - Customized React custom state controls (Safe driving trackers, Sync hooks, Preference listeners).
*   `src/types/` - Shared and local Typescript types, models, and enumerations.
*   `src/config/` - **NEW** centralized config directory housing all visual, layout, and animation design tokens.

#### B. Unified Design Tokens Integration
Created a centralized design engine inside `/src/config/theme.ts` translating our exact `/docs/03_DesignSystem.md` spec sheet into standard, reusable code-level structures:
1.  **Typography Tokens (`TYPOGRAPHY`):** Defines standard headings (`displayTitle`, `sectionHeader`), primary content body, and scripting font tokens.
2.  **Grid Spacing Spans (`SPACING`):** Enforces our 8px geometric grid, custom padding constants, and border curves.
3.  **Component Presets (`COMPONENT_TOKENS`):** Uniform layouts for buttons, card overlays, status badges, inputs, and notification toast elements.
4.  **Micro-Motions & Easing (`TRANSITIONS`, `HOVER_SCALE`):** Standardizes physics-based motion constants to maintain tactile feedback.
5.  **Icon Guidelines (`ICON_CONFIG`):** Standardizes stroke width, inline sizes, and layout hero sizes for Lucide-React.

---

### 3. Guidelines for Subsequent Sprints
All developers must adhere strictly to the **AI RULES & GUARDRAILS** established in Version 3.1:
*   **Backward Compatibility:** Preserve 100% data compatibility with `localStorage` keys and IndexedDB schemas.
*   **Zero Regression:** Maintain existing API routing (`/api/*`), RSS extraction engines, and core audio stream playback stability.
*   **Craftsmanship-first:** Utilize the standard color tokens and physics transitions defined in the central theme file for any visual enhancements.
