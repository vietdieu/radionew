# CommuteCast 3.0: AI Broadcast Studio
## Document 03: Design System

This document outlines the visual language, design system rules, and UI tokens of **CommuteCast 3.0 (AI Broadcast Studio)**, built using modern utility tokens in **Tailwind CSS v4** paired with **Lucide React** and **Motion** animations.

---

### 1. Typography Pairings & Hierarchy

We pair a sleek, highly legible neo-grotesque sans-serif for interface controls with a technical monospaced font for live broadcast scripts, telemetry data, and audio metrics.

*   **Primary Sans-Serif:** **Inter** or **Outfit**
    *   *Usage:* Navigation, button labels, form elements, card descriptions.
    *   *Key Classes:* `font-sans antialiased text-slate-800 tracking-normal`
*   **Technical / Script Font:** **JetBrains Mono** or **Fira Code**
    *   *Usage:* Audio scripts, prompter captions, time codes, telemetry logs, configuration JSONs.
    *   *Key Classes:* `font-mono tracking-tight text-emerald-500`

#### Scale & Leading:
*   **Hero / Display Titles (Workspace):** `text-3xl md:text-4xl font-bold tracking-tight text-slate-950 leading-tight`
*   **Section Headers / Titles:** `text-xl font-semibold text-slate-900 tracking-tight leading-snug`
*   **Primary Content Body:** `text-sm md:text-base text-slate-600 leading-relaxed`
*   **Scripts / Metadata:** `text-xs md:text-sm font-mono text-slate-500 tracking-tight`

---

### 2. Spacing, Borders, and Radii Grid

We enforce a strict geometric rhythm based on an 8px grid (0.5rem) to preserve clean negative space, emphasizing breathing room over high-density layouts.

#### Spacing Tokens:
*   **Content Container Padding:** `p-6` or `p-8` (24px to 32px)
*   **Grid Column Gap:** `gap-6` (24px) or `gap-8` (32px)
*   **Component Row Gaps:** `space-y-4` (16px) or `space-y-6` (24px)
*   **Inline Element Spacing:** `gap-3` (12px) or `gap-2` (8px)

#### Border & Corner System:
*   **Smooth Interactive Radii:** `rounded-xl` (12px) for cards, dialog frames, and sidebars.
*   **Control Radii:** `rounded-lg` (8px) for buttons, text inputs, selection dropdowns.
*   **Rounded Badges / Chips:** `rounded-full` (9999px) for pill states and audio tag indicators.
*   **Default Borders:** `border border-slate-200/80` or `border border-slate-100` with subtle contrast.

#### Elevation & Shadows:
*   **Level 0 (Flat Canvas Background):** `bg-slate-50` / `bg-slate-900`
*   **Level 1 (Default Card surface):** `bg-white` + `shadow-sm` (`shadow-slate-100/60`)
*   **Level 2 (Hover state / Popovers):** `bg-white` + `shadow-md` (`shadow-slate-200/40`)
*   **Level 3 (Modal Overlay Panels):** `bg-white` + `shadow-xl` (`shadow-slate-300/30`)

---

### 3. Comprehensive Component Token Definitions

#### A. Button Component Tokens

```ts
// Standard Button Base
const baseButton = "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-98 cursor-pointer rounded-lg px-4 py-2.5 text-sm";

// Variant Library
const buttons = {
  primary: `${baseButton} bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md focus:ring-indigo-500`,
  secondary: `${baseButton} bg-slate-100 hover:bg-slate-200 text-slate-700 focus:ring-slate-400`,
  outline: `${baseButton} bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800`,
  danger: `${baseButton} bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500`,
  ghost: `${baseButton} bg-transparent hover:bg-slate-50 text-slate-500 hover:text-slate-700`
};
```

#### B. Card Component Tokens

```ts
const card = {
  container: "bg-white border border-slate-150 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden",
  header: "border-b border-slate-100 p-5 flex items-center justify-between bg-slate-50/50",
  body: "p-6 space-y-4",
  footer: "border-t border-slate-100 p-4 flex items-center justify-end bg-slate-50/30"
};
```

#### C. Badge & Chip Component Tokens

```ts
const badges = {
  active: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50",
  draft: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/50",
  archived: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/40",
  interactiveChip: "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/40 transition-all duration-200 cursor-pointer"
};
```

#### D. Dropdowns & Selects

```ts
const inputFields = {
  select: "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
  menuContainer: "absolute right-0 mt-2 w-56 origin-top-right rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5 divide-y divide-slate-100 focus:outline-none"
};
```

#### E. Toasts & Notifications

```ts
const toasts = {
  success: "flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3.5 text-sm text-white shadow-xl max-w-sm pointer-events-auto",
  error: "flex items-center gap-3 rounded-xl bg-rose-950 border border-rose-800 px-4 py-3.5 text-sm text-rose-200 shadow-xl max-w-sm pointer-events-auto"
};
```

---

### 4. Interactive Micro-Motions & Transitions

Animations are subtle and physics-driven to simulate material tactility. We utilize `motion/react` with spring physics parameters.

```ts
// Standard Motion Parameters
export const transitions = {
  springComfortable: { type: "spring", stiffness: 380, damping: 30 },
  springSnappy: { type: "spring", stiffness: 450, damping: 25 },
  easeSmooth: { type: "tween", ease: "easeInOut", duration: 0.25 }
};

// Micro-interaction presets
export const hoverScale = {
  hover: { scale: 1.02, y: -2, transition: { duration: 0.2 } },
  tap: { scale: 0.98 }
};

export const pageFadeEntrance = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 }
};
```

---

### 5. Unified Iconography Rules

*   **System Core:** `lucide-react` is the single source of truth for symbols.
*   **Stroke Weight:** Ensure consistent usage of a `1.5` or `1.75` stroke width across all screen panels.
*   **Sizing Convention:**
    *   *Inline text icons:* `h-4 w-4`
    *   *Toolbar & Button icons:* `h-5 w-5`
    *   *Card / Dashboard Hero icons:* `h-6 w-6` or `h-8 w-8` (placed in a colored padding box)
*   **Selected Symbol Guide:**
    *   *Studio Workspace:* `Radio`, `Mic`, `Sparkles`
    *   *Script & Content:* `FileText`, `Sliders`, `PenTool`, `CheckSquare`
    *   *Playback:* `Play`, `Pause`, `SkipForward`, `Volume2`, `Square`
    *   *Feeds / Connections:* `Rss`, `Link2`, `Calendar`, `Cloud`
