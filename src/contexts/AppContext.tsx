/**
 * AppContext — wraps all gym data (shifts, users, notifications, attendance, spontaneous openings).
 *
 * Strategy:
 *  - On mount: fetch all collections from Supabase in parallel, hydrate local state.
 *  - dispatch() applies optimistic updates to local state immediately for snappy UX,
 *    then fires the corresponding Supabase API call in the background.
 *  - Realtime subscriptions keep state fresh when other users make changes.
 *  - Falls back gracefully to INITIAL_STATE (mock data) if Supabase is unreachable.
 */
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { AppState, ShiftBlock, SpontaneousOpening, User, Notification, AttendanceLog } from '../types';
import { INITIAL_STATE } from '../data/mockData';
import { supabase } from '../lib/supabase';

// ─── Action types ─────────────────────────────────────────────────────────────

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

// ─── Pure reducer ─────────────────────────────────────────────────────────────

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
    case 'UPDATE_SHIFT':       return { ...state, shiftBlocks: state.shiftBlocks.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'ADD_SHIFT':          return { ...state, shiftBlocks: [...state.shiftBlocks, action.payload] };
    case 'DELETE_SHIFT':       return { ...state, shiftBlocks: state.shiftBlocks.filter(s => s.id !== action.payload) };
    case 'ADD_SPONTANEOUS':    return { ...state, spontaneousOpenings: [...state.spontaneousOpenings, action.payload] };
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

// ─── Row mappers (Supabase → TypeScript types) ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toUser(r: any): User {
  return {
    id: r.id, name: r.name ?? '', email: r.email ?? '', role: r.role ?? 'member',
    house: '', room: '', dateOfBirth: '', membershipStart: '', membershipEnd: '',
    createdAt: r.created_at ?? '', avatarInitials: r.avatar_initials ?? '',
    avatarId: r.avatar_id ?? undefined,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toShift(r: any): ShiftBlock {
  return {
    id: r.id, dayOfWeek: r.day_of_week, startTime: r.start_time, endTime: r.end_time,
    supervisorId: r.supervisor_id || undefined, supervisorName: r.supervisor_name || undefined,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSpont(r: any): SpontaneousOpening {
  return {
    id: r.id, supervisorId: r.supervisor_id, supervisorName: r.supervisor_name,
    date: r.date, startTime: r.start_time, endTime: r.end_time, note: r.note || undefined,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toNotif(r: any): Notification {
  return {
    id: r.id, userId: r.user_id ?? 'all', message: r.message,
    type: r.type ?? 'info', read: !!r.read, createdAt: r.created_at ?? '',
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAttendance(r: any): AttendanceLog {
  return {
    id: r.id, userId: r.user_id ?? '',
    userName: r.user_name ?? '',
    checkIn: r.check_in ?? r.created_at ?? '', checkOut: r.check_out || undefined,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  refetch: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // ── Initial fetch ──────────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    try {
      const [
        { data: users },
        { data: shifts },
        { data: sponts },
        { data: notifs },
        { data: logs },
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('name'),
        supabase.from('shift_blocks').select('*').order('day_of_week').order('start_time'),
        supabase.from('spontaneous_openings').select('*').order('date', { ascending: false }),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }),
        supabase.from('attendance_logs').select('*').order('created_at', { ascending: false }),
      ]);

      dispatch({
        type: 'SET_STATE',
        payload: {
          users:               (users  ?? []).map(toUser),
          shiftBlocks:         (shifts ?? []).map(toShift),
          spontaneousOpenings: (sponts ?? []).map(toSpont),
          notifications:       (notifs ?? []).map(toNotif),
          attendanceLogs:      (logs   ?? []).map(toAttendance),
        },
      });
    } catch {
      console.warn('[AppContext] Supabase unreachable — using mock data');
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('app-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_blocks' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spontaneous_openings' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => refetch())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  // ── Dispatch with Supabase sync ────────────────────────────────────────────
  const dispatchWithSync: React.Dispatch<Action> = useCallback((action: Action) => {
    dispatch(action); // optimistic update

    (async () => {
      try {
        switch (action.type) {
          case 'ADD_SHIFT':
            await supabase.from('shift_blocks').insert({
              title: 'New Class', trainer: '', day_of_week: action.payload.dayOfWeek,
              start_time: action.payload.startTime, end_time: action.payload.endTime,
              capacity: 10, enrolled: 0, color: '#6C63FF',
            });
            break;
          case 'UPDATE_SHIFT':
            await supabase.from('shift_blocks').update({
              day_of_week: action.payload.dayOfWeek,
              start_time: action.payload.startTime,
              end_time: action.payload.endTime,
            }).eq('id', action.payload.id);
            break;
          case 'DELETE_SHIFT':
            await supabase.from('shift_blocks').delete().eq('id', action.payload);
            break;
          case 'CLAIM_SHIFT':
            await supabase.from('shift_blocks').update({
              supervisor_id: action.payload.supervisorId,
              supervisor_name: action.payload.supervisorName,
            }).eq('id', action.payload.shiftId);
            break;
          case 'UNCLAIM_SHIFT':
            await supabase.from('shift_blocks').update({
              supervisor_id: null, supervisor_name: null,
            }).eq('id', action.payload);
            break;
          case 'ADD_SPONTANEOUS':
            await supabase.from('spontaneous_openings').insert({
              title: action.payload.note ?? 'Extra Session',
              trainer: action.payload.supervisorName ?? '',
              date: action.payload.date,
              start_time: action.payload.startTime,
              end_time: action.payload.endTime,
              capacity: 10, enrolled: 0,
            });
            break;
          case 'DELETE_SPONTANEOUS':
            await supabase.from('spontaneous_openings').delete().eq('id', action.payload);
            break;
          case 'ADD_NOTIFICATION':
            await supabase.from('notifications').insert({
              user_id: action.payload.userId === 'all' ? null : action.payload.userId,
              title: action.payload.type ?? 'Info',
              message: action.payload.message,
              read: false,
            });
            break;
          case 'MARK_NOTIFICATION_READ':
            if (action.payload === 'all') {
              await supabase.from('notifications').update({ read: true }).eq('read', false);
            } else {
              await supabase.from('notifications').update({ read: true }).eq('id', action.payload);
            }
            break;
          case 'ADD_ATTENDANCE':
            await supabase.from('attendance_logs').insert({
              user_id: action.payload.userId,
              shift_block_id: action.payload.id,
              date: new Date().toISOString().split('T')[0],
              status: 'present',
            });
            break;
          default:
            break;
        }
      } catch (err) {
        console.warn('[AppContext] Supabase sync failed, re-fetching:', err);
        await refetch();
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
