import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeMode = "light" | "dark" | "eyecare" | "auto";

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark" | "eyecare";
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "commutecast_theme_preference";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return (saved as ThemeMode) || "auto";
    } catch {
      return "auto";
    }
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark" | "eyecare">("light");

  const determineTheme = (currentTheme: ThemeMode): "light" | "dark" | "eyecare" => {
    if (currentTheme === "light") return "light";
    if (currentTheme === "dark") return "dark";
    if (currentTheme === "eyecare") return "eyecare";

    // Auto mode resolution
    if (typeof window !== "undefined") {
      const hours = new Date().getHours();
      // Nighttime: 18:00 (6 PM) to 6:00 (6 AM)
      const isNight = hours >= 18 || hours < 6;
      if (isNight) {
        return "dark";
      }
      const systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      return systemPrefersDark ? "dark" : "light";
    }
    return "light";
  };

  useEffect(() => {
    const resolved = determineTheme(theme);
    setResolvedTheme(resolved);

    // Apply attribute and classes to document element
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      
      // Update data-theme attribute
      root.setAttribute("data-theme", resolved);
      
      // Keep class-based dark mode compatible for legacy third-party components
      if (resolved === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, [theme]);

  // Listen to system theme changes or time-based intervals if "auto"
  useEffect(() => {
    if (theme !== "auto") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setResolvedTheme(determineTheme("auto"));
    };

    // Listen to OS preference changes
    mediaQuery.addEventListener("change", handleChange);

    // Dynamic hourly check for time-based auto changes
    const timer = setInterval(() => {
      setResolvedTheme(determineTheme("auto"));
    }, 60000); // Check every minute

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
      clearInterval(timer);
    };
  }, [theme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, newTheme);
    } catch (e) {
      console.warn("Failed to save theme to localStorage", e);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
