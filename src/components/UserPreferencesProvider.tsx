import React, { createContext, useContext, useState, useEffect } from "react";
import { syncSavePreferencesAsync } from "../services/syncService";

// Types for user preferences
export type PreferedVoice = "vi-HN" | "vi-HCM" | "en-US" | "en-UK" | "Kore" | "Puck" | "Charon" | "Fenrir" | "Zephyr";
export type DefaultLanguage = "vi" | "en" | "bilingual";
export type ReadSpeed = 0.8 | 0.9 | 1.0 | 1.1 | 1.2 | 1.3;

export interface UserPreferences {
  voice: PreferedVoice;
  language: DefaultLanguage;
  speed: ReadSpeed;
  isDrivingMode: boolean;
}

interface UserPreferencesContextType {
  preferences: UserPreferences;
  updateVoice: (voice: PreferedVoice) => void;
  updateLanguage: (language: DefaultLanguage) => void;
  updateSpeed: (speed: ReadSpeed) => void;
  updateDrivingMode: (isDriving: boolean) => void;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  voice: "vi-HN",
  language: "bilingual",
  speed: 1.0,
  isDrivingMode: false
};

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "commutecast_user_preferences";

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Fallback checks to ensure schema validation
        return {
          voice: parsed.voice || DEFAULT_PREFERENCES.voice,
          language: parsed.language || DEFAULT_PREFERENCES.language,
          speed: parsed.speed || DEFAULT_PREFERENCES.speed,
          isDrivingMode: parsed.isDrivingMode !== undefined ? parsed.isDrivingMode : DEFAULT_PREFERENCES.isDrivingMode
        };
      }
    } catch (e) {
      console.warn("Failed to load user preferences from localStorage:", e);
    }
    return DEFAULT_PREFERENCES;
  });

  // Save to localStorage when preferences change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(preferences));
      // Sync with cloud (does not block local storage saving)
      syncSavePreferencesAsync(preferences).catch((err) => {
        console.warn("[Sync] Failed to sync updated preferences to cloud:", err);
      });
    } catch (e) {
      console.warn("Failed to save user preferences to localStorage:", e);
    }
  }, [preferences]);

  const updateVoice = (voice: PreferedVoice) => {
    setPreferences((prev) => ({ ...prev, voice }));
  };

  const updateLanguage = (language: DefaultLanguage) => {
    setPreferences((prev) => ({ ...prev, language }));
  };

  const updateSpeed = (speed: ReadSpeed) => {
    setPreferences((prev) => ({ ...prev, speed }));
  };

  const updateDrivingMode = (isDrivingMode: boolean) => {
    setPreferences((prev) => ({ ...prev, isDrivingMode }));
  };

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        updateVoice,
        updateLanguage,
        updateSpeed,
        updateDrivingMode
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error("useUserPreferences must be used within a UserPreferencesProvider");
  }
  return context;
}
