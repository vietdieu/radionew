import { useState, useEffect, useCallback } from "react";
import { useUserPreferences } from "../components/UserPreferencesProvider";

export interface UseDrivingModeReturn {
  isDrivingMode: boolean;
  toggleDrivingMode: () => void;
  enableDrivingMode: () => void;
  disableDrivingMode: () => void;
  toast: {
    message: string | null;
    show: boolean;
  };
  clearToast: () => void;
}

export function useDrivingMode(uiLanguage: "vi" | "en" = "vi"): UseDrivingModeReturn {
  const { preferences, updateDrivingMode } = useUserPreferences();
  const [toastState, setToastState] = useState<{ message: string | null; show: boolean }>({
    message: null,
    show: false,
  });

  const enableDrivingMode = useCallback(() => {
    updateDrivingMode(true);
    const msg = uiLanguage === "vi" ? "Chế độ lái xe đã bật" : "Driving Mode Enabled";
    setToastState({ message: msg, show: true });
  }, [updateDrivingMode, uiLanguage]);

  const disableDrivingMode = useCallback(() => {
    updateDrivingMode(false);
    setToastState({ message: null, show: false });
  }, [updateDrivingMode]);

  const toggleDrivingMode = useCallback(() => {
    if (preferences.isDrivingMode) {
      disableDrivingMode();
    } else {
      enableDrivingMode();
    }
  }, [preferences.isDrivingMode, enableDrivingMode, disableDrivingMode]);

  const clearToast = useCallback(() => {
    setToastState(prev => ({ ...prev, show: false }));
  }, []);

  // Auto-clear toast after 3.5 seconds
  useEffect(() => {
    if (toastState.show) {
      const timer = setTimeout(() => {
        clearToast();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toastState.show, clearToast]);

  return {
    isDrivingMode: preferences.isDrivingMode,
    toggleDrivingMode,
    enableDrivingMode,
    disableDrivingMode,
    toast: toastState,
    clearToast
  };
}
