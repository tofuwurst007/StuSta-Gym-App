import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          role: 'admin' | 'trainer' | 'member';
          avatar_id: string | null;
          avatar_initials: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      shift_blocks: {
        Row: {
          id: string;
          title: string;
          trainer: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          capacity: number;
          enrolled: number;
          color: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['shift_blocks']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['shift_blocks']['Insert']>;
      };
      spontaneous_openings: {
        Row: {
          id: string;
          title: string;
          trainer: string;
          date: string;
          start_time: string;
          end_time: string;
          capacity: number;
          enrolled: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['spontaneous_openings']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['spontaneous_openings']['Insert']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          message: string;
          read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
      attendance_logs: {
        Row: {
          id: string;
          user_id: string;
          shift_block_id: string;
          date: string;
          status: 'present' | 'absent' | 'late';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['attendance_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['attendance_logs']['Insert']>;
      };
    };
  };
};
