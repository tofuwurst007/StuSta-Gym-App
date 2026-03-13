import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { AppState, ShiftBlock, SpontaneousOpening, User, Notification, AttendanceLog } from '../types';
import { INITIAL_STATE } from '../data/mockData';

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

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATE':
      return action.payload;
    case 'UPDATE_USER':
      return { ...state, users: state.users.map(u => u.id === action.payload.id ? action.payload : u) };
    case 'DELETE_USER':
      return { ...state, users: state.users.filter(u => u.id !== action.payload) };
    case 'ADD_USER':
      return { ...state, users: [...state.users, action.payload] };
    case 'CLAIM_SHIFT':
      return {
        ...state,
        shiftBlocks: state.shiftBlocks.map(s =>
          s.id === action.payload.shiftId
            ? { ...s, supervisorId: action.payload.supervisorId, supervisorName: action.payload.supervisorName }
            : s
        ),
      };
    case 'UNCLAIM_SHIFT':
      return {
        ...state,
        shiftBlocks: state.shiftBlocks.map(s =>
          s.id === action.payload ? { ...s, supervisorId: undefined, supervisorName: undefined } : s
        ),
      };
    case 'UPDATE_SHIFT':
      return { ...state, shiftBlocks: state.shiftBlocks.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'ADD_SHIFT':
      return { ...state, shiftBlocks: [...state.shiftBlocks, action.payload] };
    case 'DELETE_SHIFT':
      return { ...state, shiftBlocks: state.shiftBlocks.filter(s => s.id !== action.payload) };
    case 'ADD_SPONTANEOUS':
      return { ...state, spontaneousOpenings: [...state.spontaneousOpenings, action.payload] };
    case 'DELETE_SPONTANEOUS':
      return { ...state, spontaneousOpenings: state.spontaneousOpenings.filter(s => s.id !== action.payload) };
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.payload, ...state.notifications] };
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload || action.payload === 'all' ? { ...n, read: true } : n
        ),
      };
    case 'ADD_ATTENDANCE':
      return { ...state, attendanceLogs: [action.payload, ...state.attendanceLogs] };
    case 'CHECKOUT_ATTENDANCE':
      return {
        ...state,
        attendanceLogs: state.attendanceLogs.map(a =>
          a.id === action.payload.id ? { ...a, checkOut: action.payload.checkOut } : a
        ),
      };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = 'stusta-gym-state';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE, (init) => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : init;
    } catch {
      return init;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
