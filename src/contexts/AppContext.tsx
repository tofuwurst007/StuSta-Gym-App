/**
 * AppContext — wraps all gym data (shifts, users, notifications, attendance, spontaneous openings).
 *
 * Strategy:
 *  - Fetch all collections from Supabase in parallel; refetch whenever the logged-in user changes
 *    (RLS decides what each role may see).
 *  - dispatch() applies an optimistic update to local state immediately for snappy UX, then writes
 *    to Supabase. It resolves to { ok, error }: on failure the error is surfaced (syncError) and
 *    local state is reverted by refetching. Successful inserts refetch to pick up real ids.
 *  - Realtime subscriptions keep state fresh when other users make changes.
 */
import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, useState } from 'react';
import type { AppState, ShiftBlock, SpontaneousOpening, User, Notification, AttendanceLog } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { localISODate } from '../utils/date';

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

export type SyncResult = { ok: boolean; error?: string };

const EMPTY_STATE: AppState = {
  users: [], shiftBlocks: [], spontaneousOpenings: [], notifications: [], attendanceLogs: [],
};

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
    house: r.house ?? '', room: r.room ?? '',
    dateOfBirth: r.date_of_birth ?? '',
    membershipStart: r.membership_start ?? '',
    membershipEnd: r.membership_end ?? '',
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
    id: r.id, supervisorId: r.supervisor_id ?? '', supervisorName: r.supervisor_name || r.trainer || '',
    date: r.date, startTime: r.start_time, endTime: r.end_time, note: r.note || undefined,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toNotif(r: any, readBroadcasts: Set<string>): Notification {
  const broadcast = r.user_id == null;
  return {
    id: r.id, userId: r.user_id ?? 'all', message: r.message,
    type: r.type ?? 'info',
    // A broadcast row is shared by everyone, so its read state lives per user in notification_reads
    read: broadcast ? readBroadcasts.has(r.id) : !!r.read,
    createdAt: r.created_at ?? '',
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

const NOTIF_TITLES: Record<Notification['type'], string> = { info: 'Info', warning: 'Warning', alert: 'Alert' };

// Optimistic rows carry temporary ids (e.g. "s-1712345") until the refetch after insert
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const NO_PERMISSION = "You don't have permission to do that.";
const STILL_SAVING  = 'Still saving — please try again in a moment.';

function friendlyError(message: string): string {
  if (/row-level security|permission denied/i.test(message)) return NO_PERMISSION;
  // fetch failures plus gateway errors while the backend is down (Kong/envoy/Caddy texts)
  if (/failed to fetch|network|upstream|bad gateway|service unavailable|no healthy|gateway time-?out/i.test(message)) {
    return "Can't reach the server. Check your connection.";
  }
  return message;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppContextType {
  state: AppState;
  dispatch: (action: Action) => Promise<SyncResult>;
  refetch: () => Promise<void>;
  loading: boolean;
  loadError: boolean;
  syncError: string | null;
  clearSyncError: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? null;

  // Latest state for dispatch, which needs pre-update values (e.g. which notifications were unread)
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    try {
      const [users, shifts, sponts, notifs, logs, reads] = await Promise.all([
        supabase.from('profiles').select('*').order('name'),
        supabase.from('shift_blocks').select('*').order('day_of_week').order('start_time'),
        supabase.from('spontaneous_openings').select('*').order('date', { ascending: false }),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }),
        supabase.from('attendance_logs').select('*').order('check_in', { ascending: false }),
        userId
          ? supabase.from('notification_reads').select('notification_id').eq('user_id', userId)
          : Promise.resolve({ data: [] as { notification_id: string }[], error: null }),
      ]);

      // The schedule is what everyone needs; without it there's nothing meaningful to show
      if (shifts.error) {
        console.error('[AppContext] fetch failed:', shifts.error.message);
        setLoadError(true);
        return;
      }
      for (const res of [users, sponts, notifs, logs, reads]) {
        if (res.error) console.warn('[AppContext] partial fetch error:', res.error.message);
      }

      const readBroadcasts = new Set((reads.data ?? []).map(r => r.notification_id));
      setLoadError(false);
      dispatch({
        type: 'SET_STATE',
        payload: {
          users:               (users.data  ?? []).map(toUser),
          shiftBlocks:         (shifts.data ?? []).map(toShift),
          spontaneousOpenings: (sponts.data ?? []).map(toSpont),
          notifications:       (notifs.data ?? []).map(r => toNotif(r, readBroadcasts)),
          attendanceLogs:      (logs.data   ?? []).map(toAttendance),
        },
      });
    } catch (err) {
      console.error('[AppContext] fetch crashed:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Runs on mount and again whenever the logged-in user changes
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
  const dispatchWithSync = useCallback(async (action: Action): Promise<SyncResult> => {
    const before = stateRef.current;
    dispatch(action); // optimistic update

    let error: { message: string } | null = null;
    let refetchAfter = false;

    // RLS silently filters rows on update/delete, so "0 rows changed" counts as a failure too
    const expectRows = (res: { data: unknown[] | null; error: { message: string } | null }) =>
      res.error ?? (res.data && res.data.length === 0 ? { message: NO_PERMISSION } : null);

    try {
      switch (action.type) {
        case 'UPDATE_USER':
          error = expectRows(await supabase.from('profiles').update({
            name: action.payload.name,
            role: action.payload.role,
            avatar_id: action.payload.avatarId ?? null,
            avatar_initials: action.payload.avatarInitials ?? null,
            house: action.payload.house || null,
            room: action.payload.room || null,
            date_of_birth: action.payload.dateOfBirth || null,
            membership_start: action.payload.membershipStart || null,
            membership_end: action.payload.membershipEnd || null,
          }).eq('id', action.payload.id).select('id'));
          break;
        case 'DELETE_USER':
          // Deletes the login account; the profile and related rows cascade
          ({ error } = await supabase.rpc('admin_delete_user', { target: action.payload }));
          break;
        case 'ADD_SHIFT':
          ({ error } = await supabase.from('shift_blocks').insert({
            title: 'New Class', trainer: '', day_of_week: action.payload.dayOfWeek,
            start_time: action.payload.startTime, end_time: action.payload.endTime,
            capacity: 10, enrolled: 0, color: '#6C63FF',
          }));
          refetchAfter = true;
          break;
        case 'UPDATE_SHIFT':
          if (!isUuid(action.payload.id)) { error = { message: STILL_SAVING }; break; }
          error = expectRows(await supabase.from('shift_blocks').update({
            day_of_week: action.payload.dayOfWeek,
            start_time: action.payload.startTime,
            end_time: action.payload.endTime,
          }).eq('id', action.payload.id).select('id'));
          break;
        case 'DELETE_SHIFT':
          if (!isUuid(action.payload)) { error = { message: STILL_SAVING }; break; }
          error = expectRows(await supabase.from('shift_blocks').delete().eq('id', action.payload).select('id'));
          break;
        case 'CLAIM_SHIFT':
        case 'UNCLAIM_SHIFT': {
          const shiftId = action.type === 'CLAIM_SHIFT' ? action.payload.shiftId : action.payload;
          if (!isUuid(shiftId)) { error = { message: STILL_SAVING }; break; }
          // Server-side function: atomic, and it fills in the supervisor's id/name itself
          ({ error } = await supabase.rpc('claim_shift', { p_shift_id: shiftId, p_claim: action.type === 'CLAIM_SHIFT' }));
          break;
        }
        case 'ADD_SPONTANEOUS':
          ({ error } = await supabase.from('spontaneous_openings').insert({
            title: action.payload.note || 'Extra Session',
            trainer: action.payload.supervisorName,
            supervisor_id: action.payload.supervisorId,
            supervisor_name: action.payload.supervisorName,
            note: action.payload.note ?? null,
            date: action.payload.date,
            start_time: action.payload.startTime,
            end_time: action.payload.endTime,
            capacity: 10, enrolled: 0,
          }));
          refetchAfter = true;
          break;
        case 'DELETE_SPONTANEOUS':
          if (!isUuid(action.payload)) { error = { message: STILL_SAVING }; break; }
          error = expectRows(await supabase.from('spontaneous_openings').delete().eq('id', action.payload).select('id'));
          break;
        case 'ADD_NOTIFICATION':
          ({ error } = await supabase.from('notifications').insert({
            user_id: action.payload.userId === 'all' ? null : action.payload.userId,
            title: NOTIF_TITLES[action.payload.type],
            message: action.payload.message,
            type: action.payload.type,
            read: false,
          }));
          refetchAfter = true;
          break;
        case 'MARK_NOTIFICATION_READ': {
          if (!userId) break;
          const targets = before.notifications.filter(n =>
            !n.read && isUuid(n.id) && (action.payload === 'all' || n.id === action.payload));
          const personal  = targets.filter(n => n.userId !== 'all').map(n => n.id);
          const broadcast = targets.filter(n => n.userId === 'all').map(n => n.id);
          if (personal.length) {
            ({ error } = await supabase.from('notifications').update({ read: true }).in('id', personal));
          }
          if (!error && broadcast.length) {
            ({ error } = await supabase.from('notification_reads').upsert(
              broadcast.map(id => ({ notification_id: id, user_id: userId })),
              { onConflict: 'notification_id,user_id', ignoreDuplicates: true },
            ));
          }
          break;
        }
        case 'ADD_ATTENDANCE':
          ({ error } = await supabase.from('attendance_logs').insert({
            user_id: action.payload.userId,
            user_name: action.payload.userName,
            check_in: action.payload.checkIn,
            date: localISODate(new Date(action.payload.checkIn)),
            status: 'present',
          }));
          refetchAfter = true;
          break;
        case 'CHECKOUT_ATTENDANCE':
          if (!isUuid(action.payload.id)) { error = { message: STILL_SAVING }; break; }
          error = expectRows(await supabase.from('attendance_logs')
            .update({ check_out: action.payload.checkOut }).eq('id', action.payload.id).select('id'));
          break;
        default:
          break;
      }
    } catch (err) {
      error = { message: err instanceof Error ? err.message : String(err) };
    }

    if (error) {
      const message = friendlyError(error.message);
      console.error(`[AppContext] ${action.type} failed:`, error.message);
      setSyncError(message);
      // Revert the optimistic update right away (refetch alone can't when the server is down),
      // then reload in case others changed something meanwhile
      dispatch({ type: 'SET_STATE', payload: before });
      await refetch();
      return { ok: false, error: message };
    }
    if (refetchAfter) await refetch();
    return { ok: true };
  }, [refetch, userId]);

  const clearSyncError = useCallback(() => setSyncError(null), []);

  return (
    <AppContext.Provider value={{ state, dispatch: dispatchWithSync, refetch, loading, loadError, syncError, clearSyncError }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
