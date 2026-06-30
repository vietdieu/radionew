// src/features/keyboard/useKeyboardShortcuts.ts
import { useEffect } from "react";

interface ShortcutHandlers {
  onTogglePlay?: () => void;
  onToggleDrivingMode?: () => void;
  onFocusSearch?: () => void;
  onCloseDialog?: () => void;
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onToggleDrivingMode,
  onFocusSearch,
  onCloseDialog,
  onSeekBackward,
  onSeekForward
}: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore shortcuts if user is actively typing in input/textarea/select fields
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea" || tagName === "select" || (activeEl as HTMLElement).isContentEditable) {
          // Allow ESC to unfocus or close dialog even when inside inputs
          if (event.key === "Escape") {
            (activeEl as HTMLElement).blur();
            if (onCloseDialog) onCloseDialog();
          }
          return;
        }
      }

      switch (event.key) {
        case " ":
          // Prevent standard page down scrolling with space
          event.preventDefault();
          if (onTogglePlay) onTogglePlay();
          break;
        case "m":
        case "M":
          if (onToggleDrivingMode) onToggleDrivingMode();
          break;
        case "/":
          event.preventDefault();
          if (onFocusSearch) onFocusSearch();
          break;
        case "Escape":
          if (onCloseDialog) onCloseDialog();
          break;
        case "ArrowLeft":
          if (onSeekBackward) onSeekBackward();
          break;
        case "ArrowRight":
          if (onSeekForward) onSeekForward();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onTogglePlay, onToggleDrivingMode, onFocusSearch, onCloseDialog, onSeekBackward, onSeekForward]);
}
