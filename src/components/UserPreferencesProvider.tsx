import React, { createContext, useContext, useState, useEffect } from "react";
import { syncSavePreferencesAsync } from "../services/syncService";
import { BroadcastConfiguration, LanguageMode } from "../types";

export type PreferedVoice = string;
export type DefaultLanguage = "vi" | "en" | "bilingual";
export type ReadSpeed = number;

export type UserPreferences = BroadcastConfiguration;

interface UserPreferencesContextType {
  preferences: BroadcastConfiguration;
  updatePreferences: (prefs: Partial<BroadcastConfiguration>) => void;
  updateVoice: (voice: PreferedVoice) => void;
  updateLanguage: (language: DefaultLanguage) => void;
  updateSpeed: (speed: ReadSpeed) => void;
  updateDrivingMode: (isDriving: boolean) => void;
}

const DEFAULT_PREFERENCES: BroadcastConfiguration = {
  languageMode: LanguageMode.BILINGUAL,
  language: "bilingual",
  voiceVN: "vi-HN",
  voiceEN: "en-US",
  rate: 1.0,
  speed: 1.0,
  pitch: 1.0,
  isDrivingMode: false,
  targetDuration: "medium",
  tone: "conversational",
  focus: "general overview of major events",
  commuteType: "driving",
  customInstructions: "",
  locationName: "Hanoi",
  commuteRoute: "",
  voice: "vi-HN"
};

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "commutecast_user_preferences";

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<BroadcastConfiguration>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        
        const voice = parsed.voice || DEFAULT_PREFERENCES.voice;
        const language = parsed.language || DEFAULT_PREFERENCES.language;
        const speed = parsed.speed || DEFAULT_PREFERENCES.speed;
        const isDrivingMode = parsed.isDrivingMode !== undefined ? parsed.isDrivingMode : DEFAULT_PREFERENCES.isDrivingMode;
        
        let voiceVN = parsed.voiceVN || (voice.startsWith("vi") ? voice : DEFAULT_PREFERENCES.voiceVN);
        let voiceEN = parsed.voiceEN || (voice.startsWith("vi") ? DEFAULT_PREFERENCES.voiceEN : voice);
        
        let languageMode: LanguageMode = parsed.languageMode || LanguageMode.BILINGUAL;
        if (!parsed.languageMode) {
          if (language === "vi") languageMode = LanguageMode.VN_ONLY;
          else if (language === "en") languageMode = LanguageMode.EN_ONLY;
          else languageMode = LanguageMode.BILINGUAL;
        }
        
        const rate = parsed.rate || speed;
        const pitch = parsed.pitch !== undefined ? parsed.pitch : DEFAULT_PREFERENCES.pitch;
        const targetDuration = parsed.targetDuration || DEFAULT_PREFERENCES.targetDuration;
        const tone = parsed.tone || DEFAULT_PREFERENCES.tone;
        const focus = parsed.focus || DEFAULT_PREFERENCES.focus;
        const commuteType = parsed.commuteType || DEFAULT_PREFERENCES.commuteType;
        const customInstructions = parsed.customInstructions || DEFAULT_PREFERENCES.customInstructions;
        const locationName = parsed.locationName || DEFAULT_PREFERENCES.locationName;
        const commuteRoute = parsed.commuteRoute || DEFAULT_PREFERENCES.commuteRoute;

        return {
          languageMode,
          language,
          voiceVN,
          voiceEN,
          rate,
          speed,
          pitch,
          isDrivingMode,
          targetDuration,
          tone,
          focus,
          commuteType,
          customInstructions,
          locationName,
          commuteRoute,
          voice
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

  const updatePreferences = (updates: Partial<BroadcastConfiguration>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...updates };
      
      // Smart synchronization rules to keep both legacy & modern schema state 100% congruent
      if (updates.languageMode !== undefined) {
        if (updates.languageMode === LanguageMode.VN_ONLY) {
          next.language = "vi";
          next.voice = next.voiceVN;
        } else if (updates.languageMode === LanguageMode.EN_ONLY) {
          next.language = "en";
          next.voice = next.voiceEN;
        } else {
          next.language = "bilingual";
          next.voice = next.voiceVN;
        }
      } else if (updates.language !== undefined) {
        if (updates.language === "vi") {
          next.languageMode = LanguageMode.VN_ONLY;
          next.voice = next.voiceVN;
        } else if (updates.language === "en") {
          next.languageMode = LanguageMode.EN_ONLY;
          next.voice = next.voiceEN;
        } else {
          next.languageMode = LanguageMode.BILINGUAL;
          next.voice = next.voiceVN;
        }
      }
      
      if (updates.rate !== undefined) {
        next.speed = updates.rate;
      } else if (updates.speed !== undefined) {
        next.rate = updates.speed;
      }
      
      if (updates.voiceVN !== undefined) {
        if (next.languageMode === LanguageMode.VN_ONLY || next.languageMode === LanguageMode.BILINGUAL) {
          next.voice = updates.voiceVN;
        }
      }
      if (updates.voiceEN !== undefined) {
        if (next.languageMode === LanguageMode.EN_ONLY) {
          next.voice = updates.voiceEN;
        }
      }
      if (updates.voice !== undefined) {
        if (updates.voice.startsWith("vi")) {
          next.voiceVN = updates.voice;
        } else {
          next.voiceEN = updates.voice;
        }
      }
      
      return next;
    });
  };

  const updateVoice = (voice: PreferedVoice) => {
    updatePreferences({ voice });
  };

  const updateLanguage = (language: DefaultLanguage) => {
    updatePreferences({ language });
  };

  const updateSpeed = (speed: ReadSpeed) => {
    updatePreferences({ speed });
  };

  const updateDrivingMode = (isDrivingMode: boolean) => {
    updatePreferences({ isDrivingMode });
  };

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        updatePreferences,
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
