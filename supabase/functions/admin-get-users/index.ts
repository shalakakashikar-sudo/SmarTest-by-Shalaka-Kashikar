// supabase/functions/admin-get-users/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get env vars and throw a clear error if they are missing.
function getRequiredEnv(key: string): string {
  const value = (Deno as any).env.get(key);
  if (!value) {
    throw new Error(`Function failed: Missing required environment variable "${key}". Please set this in your Supabase project's Function Secrets.`);
  }
  return value;
}

serve(async (req) => {
  // Handle CORS preflight requests.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Explicitly check for required secrets at the beginning.
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    // 1. Create a Supabase client with the user's auth token to verify their role.
    const userSupabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
      }
    );

    // 2. Fetch the user profile and check if they are an admin or teacher.
    const { data: { user } } = await userSupabaseClient.auth.getUser();
    if (user?.user_metadata?.role !== 'admin' && user?.user_metadata?.role !== 'teacher') {
      return new Response(JSON.stringify({ error: 'Permission denied.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Create a Supabase admin client using the service role key to fetch users.
    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
      }
    );
    
    // 4. List all users from auth.
    const { data: { users }, error } = await adminClient.auth.admin.listUsers();

    if (error) {
      throw error;
    }
    
    // 5. Map the user data to the format expected by the frontend.
    const manageableUsers = users
      .filter(u => u.user_metadata?.role && (u.user_metadata.role === 'student' || u.user_metadata.role === 'teacher'))
      .map(u => ({
        id: u.id,
        username: u.user_metadata?.username || 'N/A',
        full_name: u.user_metadata?.full_name || u.user_metadata?.username || 'N/A',
        role: u.user_metadata?.role,
        created_at: u.created_at,
      }));

    // 6. Return the list of users.
    return new Response(JSON.stringify(manageableUsers), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-get-users function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
