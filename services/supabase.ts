import { createClient } from '@supabase/supabase-js';

// --- IMPORTANT ---
// You must replace the placeholder ANON KEY below with your own Supabase project's public anon key.
// You can find this in your Supabase project dashboard under Settings > API.

// The Supabase URL has been set based on your project.
const supabaseUrl = 'https://nafkzazigyfrqckpxqiy.supabase.co'; 

// 2. Replace 'YOUR_SUPABASE_ANON_KEY' with your actual anon public key.
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hZmt6YXppZ3lmcnFja3B4cWl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMjY5MjUsImV4cCI6MjA3NjgwMjkyNX0.Dh2g949nHK9EHOiVx5SpQFt68CibPwXuiAXTOsaDDUg'; // <-- PASTE YOUR ANON KEY HERE

// --- Do not change the code below this line ---

// FIX: Use a global object (`window`) for the in-memory store.
// This is a robust solution for unusual environments that might reset module-level
// state, which could cause session loss. This makes the in-memory session as
// persistent as the window object itself, but it will still be cleared on a
// full page refresh.
if (!(window as any)._supabaseInMemoryStorage) {
  (window as any)._supabaseInMemoryStorage = new Map<string, string>();
}
const inMemoryStorage: Map<string, string> = (window as any)._supabaseInMemoryStorage;

const customStorageAdapter = {
  getItem: (key: string): string | null => {
    return inMemoryStorage.get(key) || null;
  },
  setItem: (key: string, value: string): void => {
    inMemoryStorage.set(key, value);
  },
  removeItem: (key: string): void => {
    inMemoryStorage.delete(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorageAdapter,
    // Explicitly set persistSession to true to ensure the client uses the storage adapter.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
