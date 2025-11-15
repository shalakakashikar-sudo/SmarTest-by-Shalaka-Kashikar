// supabase/functions/admin-create-user/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

declare const Deno: any;

function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Function failed: Missing required environment variable "${key}".`);
  }
  return value;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { username, password, role, fullName } = await req.json();

    // Basic validation
    if (!username || !password || !role || !fullName) {
        return new Response(JSON.stringify({ error: 'Missing required fields: username, password, role, fullName' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    const lowercasedUsername = username.toLowerCase();

    // Same email generation logic as the client-side login
    const email = role === 'admin'
      ? lowercasedUsername
      : `${lowercasedUsername.split('@')[0].replace(/\s+/g, '_')}@smartest-app.dev`;

    // Create the user and confirm their email in one step
    const { data: { user }, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        user_metadata: {
            username: username,
            full_name: fullName,
            role: role,
        },
        email_confirm: true, // This is the key to fixing the login issue
    });

    if (error) {
      // Provide more specific feedback for common errors
      if (error.message.includes('unique constraint') || error.message.includes('already exists')) {
        throw new Error('A user with this username or email already exists.');
      }
      throw error;
    }

    return new Response(JSON.stringify(user), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-create-user function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});