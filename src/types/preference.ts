export interface InteractionHistory {
  id: string;
  topic: string;
  chapterId?: string;
  action: "view" | "click" | "like" | "share";
  created_at: string;
}

export interface UserPreference {
  topic: string;
  score: number;
  lastInteractedAt: string;
}

export interface AppMetadata {
  key: string;
  value: any;
}
