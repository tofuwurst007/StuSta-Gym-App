/**
 * AppContext — wraps all gym data (shifts, users, notifications, attendance, spontaneous openings).
 *
 * Strategy:
 *  - On mount: fetch all collections from PocketBase in parallel, hydrate local state.
 *  - dispatch() applies optimistic updates to local state immediately for snappy UX,
 *    then fires the corresponding PocketBase API call in the background.
 *  - Realtime subscriptions keep state fresh when other users make changes.
 *  - Falls back gracefully to INITIAL_STATE (mock data) if PocketBase is unreachable,
 *    so the app still works during development without a running backend.
 */
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { AppState, ShiftBlock, SpontaneousOpening, User, Notification, AttendanceLog } from '../types';
import { INITIAL_STATE } from '../data/mockData';
import { pb } from '../lib/pocketbase';

// ─── Action types (identical to old interface — no page changes needed) ────────

type Action =
  | { type: 'SET_STATE'; payload: AppState }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'DELETE_USER'; payload: string }
  | { type: 'ADD_USER'; payload: User }
  | { type: 'CLAIM_SHIFT'; payload: { shiftId: string; supervisorId: string; supervisorName: string } }
  | { type: 'UNCLAIM_SHIFT'; payload: string }
  | { type: 'UPDATE_SHIFT'; payload: ShiftBlock }
  | { type: 'ADD_SHIFT'; payload: ShiftBlock }
  | { type: 'DELETE_SHIFT'; payload: string }
  | { type: 'ADD_SPONTANEOUS'; payload: SpontaneousOpening }
  | { type: 'DELETE_SPONTANEOUS'; payload: string }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'ADD_ATTENDANCE'; payload: AttendanceLog }
  | { type: 'CHECKOUT_ATTENDANCE'; payload: { id: string; checkOut: string } };

// ─── Pure reducer (optimistic / local state) ─────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATE':    return action.payload;
    case 'UPDATE_USER':  return { ...state, users: state.users.map(u => u.id === action.payload.id ? action.payload : u) };
    case 'DELETE_USER':  return { ...state, users: state.users.filter(u => u.id !== action.payload) };
    case 'ADD_USER':     return { ...state, users: [...state.users, action.payload] };
    case 'CLAIM_SHIFT':
      return { ...state, shiftBlocks: state.shiftBlocks.map(s =>
        s.id === action.payload.shiftId
          ? { ...s, supervisorId: action.payload.supervisorId, supervisorName: action.payload.supervisorName }
          : s
      )};
    case 'UNCLAIM_SHIFT':
      return { ...state, shiftBlocks: state.shiftBlocks.map(s =>
        s.id === action.payload ? { ...s, supervisorId: undefined, supervisorName: undefined } : s
      )};
    case 'UPDATE_SHIFT':    return { ...state, shiftBlocks: state.shiftBlocks.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'ADD_SHIFT':       return { ...state, shiftBlocks: [...state.shiftBlocks, action.payload] };
    case 'DELETE_SHIFT':    return { ...state, shiftBlocks: state.shiftBlocks.filter(s => s.id !== action.payload) };
    case 'ADD_SPONTANEOUS': return { ...state, spontaneousOpenings: [...state.spontaneousOpenings, action.payload] };
    case 'DELETE_SPONTANEOUS': return { ...state, spontaneousOpenings: state.spontaneousOpenings.filter(s => s.id !== action.payload) };
    case 'ADD_NOTIFICATION':   return { ...state, notifications: [action.payload, ...state.notifications] };
    case 'MARK_NOTIFICATION_READ':
      return { ...state, notifications: state.notifications.map(n =>
        n.id === action.payload || action.payload === 'all' ? { ...n, read: true } : n
      )};
    case 'ADD_ATTENDANCE':      return { ...state, attendanceLogs: [action.payload, ...state.attendanceLogs] };
    case 'CHECKOUT_ATTENDANCE': return { ...state, attendanceLogs: state.attendanceLogs.map(a =>
      a.id === action.payload.id ? { ...a, checkOut: action.payload.checkOut } : a
    )};
    default: return state;
  }
}

// ─── Record mappers (PocketBase → TypeScript types) ──────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toUser(r: any): User {
  return { id: r.id, name: r.name ?? '', email: r.email ?? '', role: r.role ?? 'member',
    house: r.house ?? '', room: r.room ?? '', dateOfBirth: r.dateOfBirth ?? '',
    membershipStart: r.membershipStart ?? '', membershipEnd: r.membershipEnd ?? '',
    createdAt: r.created ?? r.createdAt ?? '', avatarInitials: r.avatarInitials,
    avatarId: r.avatarId ?? undefined };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toShift(r: any): ShiftBlock {
  return { id: r.id, dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime,
    supervisorId: r.supervisorId || undefined, supervisorName: r.supervisorName || undefined };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSpont(r: any): SpontaneousOpening {
  return { id: r.id, supervisorId: r.supervisorId, supervisorName: r.supervisorName,
    date: r.date, startTime: r.startTime, endTime: r.endTime, note: r.note || undefined };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toNotif(r: any): Notification {
  return { id: r.id, userId: r.targetUserId ?? r.userId ?? 'all', message: r.message,
    type: r.type ?? 'info', read: !!r.read, createdAt: r.created ?? r.createdAt ?? '' };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAttendance(r: any): AttendanceLog {
  return { id: r.id, userId: r.userId ?? r.expand?.user?.id ?? '',
    userName: r.userName ?? r.expand?.user?.name ?? '',
    checkIn: r.checkIn ?? r.created ?? '', checkOut: r.checkOut || undefined };
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  /** Re-fetch all collections from PocketBase (call after login/logout) */
  refetch: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // ── Initial fetch ──────────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    try {
      const [users, shifts, sponts, notifs, logs] = await Promise.all([
        pb.collection('users').getFullList({ sort: 'name' }),
        pb.collection('shift_blocks').getFullList({ sort: 'dayOfWeek,startTime' }),
        pb.collection('spontaneous_openings').getFullList({ sort: '-date' }),
        pb.collection('notifications').getFullList({ sort: '-created' }),
        pb.collection('attendance_logs').getFullList({ sort: '-checkIn' }),
      ]);
      dispatch({ type: 'SET_STATE', payload: {
        users:               users.map(toUser),
        shiftBlocks:         shifts.map(toShift),
        spontaneousOpenings: sponts.map(toSpont),
        notifications:       notifs.map(toNotif),
        attendanceLogs:      logs.map(toAttendance),
      }});
    } catch {
      // PocketBase not running — keep INITIAL_STATE (dev fallback)
      console.warn('[AppContext] PocketBase unreachable — using mock data');
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  // ── Realtime subscriptions (live updates for all users) ────────────────────
  useEffect(() => {
    let unsubShifts: (() => void) | null = null;
    let unsubSpont:  (() => void) | null = null;

    (async () => {
      try {
        unsubShifts = await pb.collection('shift_blocks').subscribe('*', () => refetch());
        unsubSpont  = await pb.collection('spontaneous_openings').subscribe('*', () => refetch());
      } catch {
        // Silently ignore — realtime is a nice-to-have
      }
    })();

    return () => {
      unsubShifts?.();
      unsubSpont?.();
    };
  }, [refetch]);

  // ── Dispatch wrapper — optimistic local update + PocketBase API call ────────
  const dispatchWithSync: React.Dispatch<Action> = useCallback((action: Action) => {
    // 1. Apply optimistic update immediately
    dispatch(action);

    // 2. Fire API call in background (fire-and-forget; refetch on error)
    (async () => {
      try {
        switch (action.type) {
          case 'ADD_USER':
            await pb.collection('users').create({ ...action.payload, password: 'changeme123', passwordConfirm: 'changeme123' });
            break;
          case 'UPDATE_USER':
            await pb.collection('users').update(action.payload.id, action.payload);
            break;
          case 'DELETE_USER':
            await pb.collection('users').delete(action.payload);
            break;
          case 'ADD_SHIFT':
            await pb.collection('shift_blocks').create(action.payload);
            break;
          case 'UPDATE_SHIFT':
            await pb.collection('shift_blocks').update(action.payload.id, action.payload);
            break;
          case 'DELETE_SHIFT':
            await pb.collection('shift_blocks').delete(action.payload);
            break;
          case 'CLAIM_SHIFT':
            await pb.collection('shift_blocks').update(action.payload.shiftId, {
              supervisorId: action.payload.supervisorId,
              supervisorName: action.payload.supervisorName,
            });
            break;
          case 'UNCLAIM_SHIFT':
            await pb.collection('shift_blocks').update(action.payload, {
              supervisorId: null, supervisorName: null,
            });
            break;
          case 'ADD_SPONTANEOUS':
            await pb.collection('spontaneous_openings').create(action.payload);
            break;
          case 'DELETE_SPONTANEOUS':
            await pb.collection('spontaneous_openings').delete(action.payload);
            break;
          case 'ADD_NOTIFICATION':
            await pb.collection('notifications').create({
              ...action.payload,
              targetUserId: action.payload.userId,
            });
            break;
          case 'MARK_NOTIFICATION_READ':
            if (action.payload === 'all') {
              // Mark all — re-fetch to get current IDs, then batch update
              const all = await pb.collection('notifications').getFullList({ filter: 'read=false' });
              await Promise.all(all.map(n => pb.collection('notifications').update(n.id, { read: true })));
            } else {
              await pb.collection('notifications').update(action.payload, { read: true });
            }
            break;
          case 'ADD_ATTENDANCE':
            await pb.collection('attendance_logs').create(action.payload);
            break;
          case 'CHECKOUT_ATTENDANCE':
            await pb.collection('attendance_logs').update(action.payload.id, { checkOut: action.payload.checkOut });
            break;
          default:
            break;
        }
      } catch (err) {
        console.warn('[AppContext] PocketBase sync failed, re-fetching:', err);
        await refetch(); // Roll back optimistic state on error
      }
    })();
  }, [refetch]);

  return (
    <AppContext.Provider value={{ state, dispatch: dispatchWithSync, refetch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
