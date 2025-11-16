// supabase/functions/get-tests/index.ts
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

    // 1. Authenticate user to ensure they are logged in.
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

    // 2. Create admin client to fetch all data, bypassing RLS.
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // --- REFACTORED DATA FETCHING LOGIC ---
    // 3. Fetch all tests first.
    const { data: testsData, error: testsError } = await adminClient
        .from('tests')
        .select('*')
        .order('created_at', { ascending: false });

    if (testsError) throw testsError;

    // If there are no tests, return an empty array.
    if (!testsData || testsData.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Fetch all questions related to the retrieved tests.
    const testIds = testsData.map(t => t.id);
    const { data: questionsData, error: questionsError } = await adminClient
      .from('questions')
      .select('*')
      .in('test_id', testIds);

    if (questionsError) throw questionsError;

    // 5. Manually join the questions to their respective tests.
    const questionsByTestId = new Map<string, any[]>();
    if (questionsData) {
      for (const question of questionsData) {
        if (!questionsByTestId.has(question.test_id)) {
          questionsByTestId.set(question.test_id, []);
        }
        questionsByTestId.get(question.test_id)!.push(question);
      }
    }

    const finalTests = testsData.map(test => ({
      ...test,
      questions: questionsByTestId.get(test.id) || []
    }));

    // 6. Return the combined data.
    return new Response(JSON.stringify(finalTests), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-tests function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});