import { createClient } from '@supabase/supabase-js';

// --- IMPORTANT ---
// You must replace the placeholder ANON KEY below with your own Supabase project's public anon key.
// You can find this in your Supabase project dashboard under Settings > API.

// The Supabase URL has been set based on your project.
const supabaseUrl = 'https://nafkzazigyfrqckpxqiy.supabase.co'; 

// 2. Replace 'YOUR_SUPABASE_ANON_KEY' with your actual anon public key.
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hZmt6YXppZ3lmcnFja3B4cWl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMjY5MjUsImV4cCI6MjA3NjgwMjkyNX0.Dh2g949nHK9EHOiVx5SpQFt68CibPwXuiAXTOsaDDUg'; // <-- PASTE YOUR ANON KEY HERE

// --- Do not change the code below this line ---

// FIX: The check for a placeholder key was causing a compile error because the key is already set.
// This check is no longer necessary and has been removed.

export const supabase = createClient(supabaseUrl, supabaseAnonKey);