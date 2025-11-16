// supabase/functions/save-test/index.ts
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
  if (!value) throw new Error(`Function failed: Missing required environment variable "${key}".`);
  return value;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY');
    
    // Authenticate the user and check their role
    const authorization = req.headers.get('Authorization');
    if (!authorization) throw new Error('Missing authorization header.');
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error(`Authentication failed: ${userError?.message || 'No user found'}`);
    
    const { role } = user.user_metadata;
    if (role !== 'teacher' && role !== 'admin') throw new Error('Permission denied. User is not a teacher or admin.');

    // Parse the test payload from the request
    const test = await req.json();
    if (!test || !test.title || !test.questions) throw new Error('Invalid test payload. Missing title or questions.');

    // Create a service role client to call the database function
    // We use the service role key because the RPC needs to bypass RLS.
    // The security is handled inside the RPC function itself.
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Call the database function to handle the upsert transactionally
    const { data: testId, error: rpcError } = await adminClient.rpc('create_or_update_test', {
      p_test_id: test.id || null,
      p_user_id: user.id,
      p_title: test.title,
      p_class: test.class,
      p_timer: test.timer,
      p_questions: test.questions
    });

    if (rpcError) {
        // The RPC will throw a specific error if permission is denied or something else goes wrong
        console.error('RPC Error:', rpcError);
        throw new Error(rpcError.message || 'Database operation failed.');
    }

    // The RPC returns the test ID. We can return the original test payload
    // with the new/updated ID for consistency with the old API.
    const finalTest = { ...test, id: testId };

    return new Response(JSON.stringify(finalTest), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in upsert-test function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
