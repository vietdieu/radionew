/**
 * CommuteCast 3.1 - Sprint 0: Foundation Design System & Theme Tokens
 * Centralized theme definitions conforming to /docs/03_DesignSystem.md
 */

// Typography Hierarchy & Font Pairings
export const TYPOGRAPHY = {
  fontSans: "font-sans antialiased text-slate-800 dark:text-slate-200 tracking-normal",
  fontMono: "font-mono tracking-tight text-emerald-500 dark:text-emerald-400",
  
  // Scale & Leading
  displayTitle: "text-3xl md:text-4xl font-bold tracking-tight text-slate-950 dark:text-white leading-tight",
  sectionHeader: "text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-snug",
  bodyText: "text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed",
  metadataText: "text-xs md:text-sm font-mono text-slate-500 dark:text-slate-400 tracking-tight",
};

// Geometric Spacing Grid (8px baseline rhythm)
export const SPACING = {
  containerPadding: "p-6 md:p-8",
  gridGap: "gap-6 md:gap-8",
  rowGap: "space-y-4 md:space-y-6",
  inlineGap: "gap-3",
  microGap: "gap-2",
  
  // Corner Radii
  radiusCard: "rounded-xl", // 12px
  radiusControl: "rounded-lg", // 8px
  radiusPill: "rounded-full", // 9999px
  
  // Borders
  borderDefault: "border border-slate-200/80 dark:border-slate-800/80",
  borderSubtle: "border border-slate-100 dark:border-slate-900",
};

// Component-Level Token Configurations
export const COMPONENT_TOKENS = {
  // Buttons System
  buttons: {
    base: "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-98 cursor-pointer rounded-lg px-4 py-2.5 text-sm select-none",
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md focus:ring-indigo-500",
    secondary: "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 focus:ring-slate-400",
    outline: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white",
    danger: "bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500",
    ghost: "bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
  },
  
  // Cards System
  card: {
    container: "bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl shadow-xs hover:shadow-md transition-all duration-300 overflow-hidden",
    header: "border-b border-slate-100 dark:border-slate-850 p-5 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50",
    body: "p-6 space-y-4",
    footer: "border-t border-slate-100 dark:border-slate-850 p-4 flex items-center justify-end bg-slate-50/30 dark:bg-slate-950/30"
  },
  
  // Badge & Status Indicators
  badges: {
    active: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30",
    draft: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30",
    archived: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/40 dark:border-slate-700/40",
    interactiveChip: "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-450 border border-indigo-200/40 dark:border-indigo-900/30 transition-all duration-200 cursor-pointer"
  },
  
  // Selection and Input System
  inputs: {
    select: "w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
    menuContainer: "absolute right-0 mt-2 w-56 origin-top-right rounded-xl bg-white dark:bg-slate-950 p-1.5 shadow-lg ring-1 ring-black/5 dark:ring-white/10 divide-y divide-slate-100 dark:divide-slate-900 focus:outline-none"
  },
  
  // Toasts
  toasts: {
    success: "flex items-center gap-3 rounded-xl bg-slate-900 dark:bg-slate-950 px-4 py-3.5 text-sm text-white shadow-xl max-w-sm pointer-events-auto",
    error: "flex items-center gap-3 rounded-xl bg-rose-950 border border-rose-800 px-4 py-3.5 text-sm text-rose-200 shadow-xl max-w-sm pointer-events-auto"
  }
};

// Physics-Based Springs and Easing Constants
export const TRANSITIONS = {
  springComfortable: { type: "spring", stiffness: 380, damping: 30 },
  springSnappy: { type: "spring", stiffness: 450, damping: 25 },
  easeSmooth: { type: "tween", ease: "easeInOut", duration: 0.25 }
};

// Micro-Interaction Framer Motion Variants
export const HOVER_SCALE = {
  hover: { scale: 1.02, y: -2, transition: { duration: 0.2 } },
  tap: { scale: 0.98 }
};

export const PAGE_FADE_ENTRANCE = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 }
};

// Standardized Icon Configurations
export const ICON_CONFIG = {
  strokeWidth: 1.75,
  sizes: {
    inline: "h-4 w-4",
    control: "h-5 w-5",
    hero: "h-6 w-6",
    large: "h-8 w-8"
  }
};
