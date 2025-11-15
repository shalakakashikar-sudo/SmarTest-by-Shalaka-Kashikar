// supabase/functions/get-submissions/index.ts

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
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    // 1. Get the user from the authorization header.
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
        return new Response(JSON.stringify({ error: 'Missing authorization header.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not authenticated.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { role } = user.user_metadata;
    if (role !== 'teacher' && role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Permission denied. User is not a teacher or admin.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // 2. Get the test ID from the request body.
    const { testId } = await req.json();
    if (!testId) {
        return new Response(JSON.stringify({ error: 'Missing testId in request body.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    
    // 3. Create an admin client to verify test ownership and fetch data.
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 4. SECURITY CHECK: Verify that the authenticated user owns the test.
    const { data: testData, error: testError } = await adminClient
        .from('tests')
        .select('created_by')
        .eq('id', testId)
        .single();
    
    if (testError) {
      if (testError.code === 'PGRST116') { // No rows found
        return new Response(JSON.stringify({ error: 'Test not found.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw testError;
    }
    
    // Admins can view any submission, teachers must own the test.
    if (role === 'teacher' && testData.created_by !== user.id) {
        return new Response(JSON.stringify({ error: 'Permission denied. You do not own this test.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // 5. If all checks pass, fetch the submissions using the admin client to bypass RLS.
    const { data: submissions, error: submissionsError } = await adminClient
        .from('test_results')
        .select('*')
        .eq('test_id', testId)
        .order('submitted_at', { ascending: false });

    if (submissionsError) throw submissionsError;

    // 6. Return the submissions.
    return new Response(JSON.stringify(submissions), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-submissions function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});