# CommuteCast 3.0: AI Broadcast Studio
## Document 05: Component Architecture

This document defines the modular React component structure for **CommuteCast 3.0 (AI Broadcast Studio)** following a strict **Atomic Design Methodology**. 

By breaking components down into Atoms, Molecules, Organisms, Templates, and Pages, we prevent monolithic file sizes (avoiding single-file over-tokenization), guarantee complete reusability, and simplify unit testing.

---

### 1. Atomic Hierarchy Overview

```
 [ ATOMS ]        ---> e.g., Icon, Button, Badge, Label, WaveformCanvas
     |
     v
 [ MOLECULES ]    ---> e.g., SearchBar, FeedItem, QueueCard, PlayerButton, VoiceSelector
     |
     v
 [ ORGANISMS ]    ---> e.g., PlayerToolbar, RSSList, ScriptEditorConsole, SystemConsole
     |
     v
 [ TEMPLATES ]    ---> e.g., SplitPaneLayout, CoreDashboardShell, FullHUDOverlay
     |
     v
 [ PAGES ]        ---> e.g., RSSStudioPage, AIStudioPage, AudioStudioPage, DrivingHUD
```

---

### 2. Component Design Specifications

#### A. Atoms (Base Construction Units)
Atoms are pure, self-contained, functional building blocks. They receive styling instructions strictly via props and do not hold business state.

*   `Button.tsx`: Coordinates padding, colors (primary/danger/ghost), hover states, and disabled parameters.
*   `Badge.tsx`: Displays pill-shaped indicators for status tags (e.g. "Synced", "Offline", "Playing").
*   `Label.tsx`: Typography elements for input titles.
*   `VolumeSlider.tsx`: Bare slider elements receiving direct min/max/step values.
*   `WaveformVisualizer.tsx`: Pure Canvas rendering loops for frequency bars.

#### B. Molecules (Contextual Groups)
Molecules combine several Atoms to create a reusable component that performs a single task.

*   `VoiceSelector.tsx`: Merges a `Label` with an interactive `Select` element to choose voice configurations (Google vs. Edge voices).
*   `PlayerButton.tsx`: Combines `Button` with Lucide play/pause icons, injecting localized hover tips.
*   `FeedItemCard.tsx`: Integrates feed metadata, active checkboxes, and an unread badge to represent a single RSS source.
*   `QueueListItem.tsx`: Consolidates segment details, duration tags, and drag handles into a single playlist card.

#### C. Organisms (Interactive Systems)
Organisms are compound systems that orchestrate groups of Molecules. They often interface with React context, hooks, or trigger service calls.

*   `PlayerToolbar.tsx`: Synthesizes play, pause, next/prev triggers, active volume meters, and active voice selectors into a unified playback dock.
*   `RSSFeedGrid.tsx`: Manages lists of `FeedItemCard` elements, offering scroll boundaries, category grouping, and bulk selectors.
*   `ScriptEditorPane.tsx`: High-performance text editor panel with syntax highlighting for voice speaker blocks, and inline segment regeneration buttons.
*   `VoiceSearchBox.tsx`: Integrates microphone visualizers with speech-to-text processing for fast system lookups.

#### D. Templates (Layout Shells)
Templates establish visual structure, defining placement zones for columns, headers, footers, and active sidebars without coupling to backend logic.

*   `DashboardLayoutTemplate.tsx`: Sets up the global layout shell featuring a fixed Left Sidebar, collapsible Main Topbar, and central content viewport.
*   `SplitPaneTemplate.tsx`: Coordinates dynamic resizable columns, useful for side-by-side RSS queues and Script editors.
*   `FullScreenHUDTemplate.tsx`: Zero-border, distraction-free overlay for hands-free driving usage.

#### E. Pages (System Views)
Pages are full screen applications that bind Templates with live data services, handling auth states, database syncing, and global state initialization.

*   `RSSStudio.tsx`: Initializes and feeds RSS subscriptions to `RSSFeedGrid`.
*   `AIStudio.tsx`: Binds the AI generator console with `ScriptEditorPane` and fetches prompt context from selected feeds.
*   `AudioStudio.tsx`: Manages voice configurations, and drives audio preview pipelines.
*   `DrivingHUDPage.tsx`: Integrates high-contrast touch models for commute scenarios.

---

### 3. Traceability Example: The Audio Pipeline

To visualize how this component architecture scales from Atom to Page, examine the breakdown of the **Audio Studio** playback features:

```
Atom: Button
  └── Simple, reusable click target with styling and hover transitions.
  
Molecule: PlayerButton
  └── Button injected with a conditional play/pause icon, showing loading indicator during TTS synthesis.
  
Organism: PlayerToolbar
  └── Combines PlayerButton (Play/Pause/Skip), dynamic Progress Slider, WaveformVisualizer, and VoiceSelector.
  
Template: SplitPaneTemplate
  └── Orchestrates the Left Column (Script sections/Chapters) and the Right Column (Active Audio Player Toolbar & Waveform console).
  
Page: AudioStudioPage
  └── Initializes the active speech script, binds broadcastSpeechEngine.ts to the toolbar events, and serves as the interactive core for the user.
```
