export type ScannerStatus = 'active' | 'blocked';
export type ScanMode   = 'qr' | 'ticketId' | 'email' | 'face';
export type ScanStatus = 'idle' | 'scanning' | 'success' | 'already_scanned' | 'invalid' | 'blocked' | 'error';

export interface ScanResultData {
  result: string;
  message: string;
  guest?: { fullName: string; ticketType: string; email: string };
}

export interface ScannerConfig {
  scannerId: string;
  scannerName: string;
}

export interface ScanHistoryEntry {
  ticketId: string;
  guestName: string;
  result: ScanStatus;
  time: string;
  mode: ScanMode;
}

export interface Scanner {
  id: string;
  name: string;
  status: ScannerStatus;
  scanCount: number;
  connectedAt: string;
  lastScanAt: string | null;
}

export interface ScanRequest {
  ticketId?: string;
  email?: string;
  faceEmbedding?: number[];
  scannerId: string;
}

export interface WSMessage {
  type:
    | 'scan_result'
    | 'scanner_joined'
    | 'scanner_left'
    | 'scanner_blocked'
    | 'scanner_unblocked'
    | 'event_ended'
    | 'stats_update'
    | 'guests_imported';
  payload: unknown;
}