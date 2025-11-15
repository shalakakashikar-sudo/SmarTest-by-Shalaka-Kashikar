// supabase/functions/delete-test/index.ts
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

    // 1. Authenticate user and check role
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
        return new Response(JSON.stringify({ error: 'Missing authorization header.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user } } = await userClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not authenticated.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { role } = user.user_metadata;
    if (role !== 'teacher' && role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Permission denied. User is not a teacher or admin.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Get test ID from body
    const { testId } = await req.json();
    if (!testId) {
        return new Response(JSON.stringify({ error: 'Missing testId in request body.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Create admin client
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 4. SECURITY CHECK: Verify ownership before deleting
    const { data: existingTest, error: fetchError } = await adminClient.from('tests').select('created_by').eq('id', testId).single();
    if (fetchError) {
        // If the test doesn't exist, it might have been deleted already. Return success.
        if (fetchError.code === 'PGRST116') {
             return new Response(JSON.stringify({ message: 'Test already deleted.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        throw new Error(`Could not find test to delete: ${fetchError.message}`);
    }
    
    // An admin can delete any test, a teacher must be the owner.
    if (role !== 'admin' && existingTest.created_by !== user.id) {
      return new Response(JSON.stringify({ error: 'Permission denied. You do not own this test.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 5. Perform cascading delete using admin privileges
    // Step 1: Delete associated results to avoid foreign key violations.
    const { error: resultsError } = await adminClient
        .from('test_results')
        .delete()
        .eq('test_id', testId);
    if (resultsError) throw new Error(`Failed to delete test results: ${resultsError.message}`);

    // Step 2: Delete associated questions.
    const { error: questionsError } = await adminClient
        .from('questions')
        .delete()
        .eq('test_id', testId);
    if (questionsError) throw new Error(`Failed to delete questions: ${questionsError.message}`);

    // Step 3: Delete the test itself.
    const { error: testError } = await adminClient
        .from('tests')
        .delete()
        .eq('id', testId);
    if (testError) throw new Error(`Failed to delete test: ${testError.message}`);

    return new Response(JSON.stringify({ message: 'Test deleted successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in delete-test function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
