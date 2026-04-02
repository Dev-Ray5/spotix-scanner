export type ExportFormat = 'csv' | 'json' | 'both';
export type ResourceType = 'terms' | 'guide';

export interface SpotixAPI {
  importGuests: (filePath: string) => Promise<{ imported: number; skipped: number } | { error: string }>;
  openGuestFileDialog: () => Promise<string | null>;
  exportLogs: (format: ExportFormat) => Promise<{ success: boolean; paths?: string[]; error?: string }>;
  endEvent: (exportFormat: ExportFormat) => Promise<{ success: boolean; paths?: string[]; error?: string }>;
  openPath: (filePath: string) => Promise<void>;
  openResource: (resource: ResourceType) => Promise<void>;
  getLocalIP: () => Promise<string>;
  getScannerUrl: () => Promise<string>;
}

declare global {
  interface Window {
    spotix: SpotixAPI;
  }
}
