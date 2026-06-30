import { logger } from "../utils/logger";

export type CloudSyncState = "CONNECTED" | "LOCAL_ONLY" | "OFFLINE" | "MISCONFIGURED" | "SYNCING";

type Listener = (state: CloudSyncState) => void;

class CloudSyncStatusService {
  private currentState: CloudSyncState = "LOCAL_ONLY";
  private listeners: Set<Listener> = new Set();
  
  // Default non-functional credentials to detect
  private readonly defaultUrl = "https://omcuhthpeenwlzdwzlra.supabase.co";
  private readonly defaultKey = "sb_publishable_jYhv4P78VyLfdsAEa70Mlw_T3vzR6Ez";

  constructor() {
    // Initial check for online status
    if (typeof window !== "undefined") {
      this.currentState = window.navigator.onLine ? "LOCAL_ONLY" : "OFFLINE";
      
      window.addEventListener("online", () => {
        if (this.currentState === "OFFLINE") {
          this.setState("LOCAL_ONLY"); // Will upgrade to CONNECTED/SYNCING once client initializes
        }
      });
      
      window.addEventListener("offline", () => {
        this.setState("OFFLINE");
      });
    }
  }

  public getState(): CloudSyncState {
    return this.currentState;
  }

  public setState(state: CloudSyncState) {
    if (this.currentState === state) return;
    
    logger.info(`[CloudSyncStatus] State transition: ${this.currentState} -> ${state}`);
    this.currentState = state;
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Call immediately with current state
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentState);
      } catch (err) {
        logger.warn("[CloudSyncStatus] Listener callback failed", err);
      }
    });
  }

  /**
   * Helper to inspect if Supabase keys are default or missing
   */
  public isConfigValid(url?: string, key?: string): boolean {
    if (!url || !key) return false;
    
    const cleanUrl = url.trim();
    const cleanKey = key.trim();

    if (cleanUrl === "" || cleanKey === "") return false;
    if (cleanUrl === this.defaultUrl) return false;
    if (cleanKey === this.defaultKey) return false;

    return true;
  }
}

export const cloudSyncStatus = new CloudSyncStatusService();
export default cloudSyncStatus;
