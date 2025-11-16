import { createClient } from '@supabase/supabase-js';

// --- IMPORTANT ---
// You must replace the placeholder ANON KEY below with your own Supabase project's public anon key.
// You can find this in your Supabase project dashboard under Settings > API.

// The Supabase URL has been set based on your project.
const supabaseUrl = 'https://nafkzazigyfrqckpxqiy.supabase.co'; 

// 2. Replace 'YOUR_SUPABASE_ANON_KEY' with your actual anon public key.
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hZmt6YXppZ3lmcnFja3B4cWl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMjY5MjUsImV4cCI6MjA3NjgwMjkyNX0.Dh2g949nHK9EHOiVx5SpQFt68CibPwXuiAXTOsaDDUg'; // <-- PASTE YOUR ANON KEY HERE

// --- Do not change the code below this line ---

// Initialize the Supabase client.
// By default, Supabase uses localStorage for session persistence, which is the
// standard and most robust method for web applications. This change removes the
// previous in-memory storage adapter, which caused sessions to be lost on
// page reloads, fixing the automatic logout issue.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // We are no longer providing a custom 'storage' adapter.
    // Supabase will default to using localStorage, which correctly persists
    // the user's session across page reloads.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
