export type Role = 'member' | 'supervisor' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  house: string;
  room: string;
  dateOfBirth: string;       // YYYY-MM-DD
  membershipStart: string;   // YYYY-MM-DD
  membershipEnd: string;     // YYYY-MM-DD
  createdAt: string;
  avatarInitials?: string;
  avatarId?: string;
}

export interface ShiftBlock {
  id: string;
  dayOfWeek: number;   // 0 = Monday … 6 = Sunday
  startTime: string;   // HH:mm
  endTime: string;     // HH:mm
  supervisorId?: string;
  supervisorName?: string;
}

export interface SpontaneousOpening {
  id: string;
  supervisorId: string;
  supervisorName: string;
  date: string;        // YYYY-MM-DD
  startTime: string;
  endTime: string;
  note?: string;
}

export interface Notification {
  id: string;
  userId: string;       // 'all' for broadcast
  message: string;
  type: 'info' | 'warning' | 'alert';
  read: boolean;
  createdAt: string;
}

export interface AttendanceLog {
  id: string;
  userId: string;
  userName: string;
  checkIn: string;     // ISO datetime
  checkOut?: string;
}

export interface AppState {
  users: User[];
  shiftBlocks: ShiftBlock[];
  spontaneousOpenings: SpontaneousOpening[];
  notifications: Notification[];
  attendanceLogs: AttendanceLog[];
}
