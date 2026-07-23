export {};

declare global {
  interface Window {
    neuralForge?: {
      platform: string;
      getCaptureSources(): Promise<CaptureSource[]>;
      setAlwaysOnTop(value: boolean): Promise<boolean>;
      saveProject(payload: unknown): Promise<{ canceled: boolean; path?: string }>;
      loadProject(): Promise<{ canceled: boolean; path?: string; data?: unknown }>;
      getAppVersion(): Promise<string>;
      checkForUpdates(): Promise<UpdateCheckResult>;
      installUpdate(): Promise<{ started: boolean; version?: string; reason?: string }>;
      onUpdateProgress(callback: (progress: UpdateProgress) => void): () => void;
    };
  }
  interface CaptureSource {
    id: string;
    name: string;
    displayId: string;
    thumbnail: string;
    icon: string | null;
  }
  interface UpdateInfo { version: string; url: string; sha256: string; size: number; notes: string; }
  interface UpdateCheckResult { currentVersion: string; updateAvailable: boolean; update: UpdateInfo | null; }
  interface UpdateProgress { received: number; total: number; percent: number; }
}
