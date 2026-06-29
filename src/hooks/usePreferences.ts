import { useState, useEffect, useCallback } from "react";
import { getTopPreferences } from "../services/preferenceService";
import { UserPreference } from "../types/preference";

export function usePreferences(limit = 5) {
  const [topTopics, setTopTopics] = useState<UserPreference[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getTopPreferences(limit);
      setTopTopics(data);
      setError(null);
    } catch (err: any) {
      console.error("[usePreferences] Error loading top preferences:", err);
      setError(err.message || "Failed to load preferences");
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchPreferences();

    // Set up auto-refresh on interaction updates
    const handleUpdate = () => {
      fetchPreferences();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("commute-cast-preference-updated", handleUpdate);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("commute-cast-preference-updated", handleUpdate);
      }
    };
  }, [fetchPreferences]);

  return {
    topTopics,
    isLoading,
    error,
    refresh: fetchPreferences,
  };
}

export default usePreferences;
