import { logger } from "../utils/logger";

export type CloudSyncState = "INITIALIZING" | "CONNECTED" | "LOCAL_ONLY" | "OFFLINE" | "MISCONFIGURED";

type Listener = (state: CloudSyncState) => void;

class CloudSyncStatusService {
  private currentState: CloudSyncState = "INITIALIZING";
  private listeners: Set<Listener> = new Set();

  constructor() {
    // Initial check for online status
    if (typeof window !== "undefined") {
      this.currentState = window.navigator.onLine ? "INITIALIZING" : "OFFLINE";
      
      window.addEventListener("online", () => {
        if (this.currentState === "OFFLINE") {
          this.setState("INITIALIZING");
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
}

export const cloudSyncStatus = new CloudSyncStatusService();
export default cloudSyncStatus;
