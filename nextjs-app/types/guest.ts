export interface Guest {
  id: string;
  fullName: string;
  email: string;
  ticketId: string;
  ticketType: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  checkedInBy: string | null;
  faceEmbedding: number[] | null;
}

export interface GuestImportRow {
  fullName: string;
  email: string;
  ticketId: string;
  ticketType: string;
  faceEmbedding?: number[];
}

export interface CheckInResult {
  result: 'success' | 'already_scanned' | 'invalid';
  guest?: Guest;
  message: string;
}
