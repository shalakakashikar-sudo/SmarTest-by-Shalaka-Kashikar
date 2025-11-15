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
    
    // 3. Fetch all tests with their questions.
    const { data, error } = await adminClient
        .from('tests')
        .select('*, questions (*)')
        .order('created_at', { ascending: false });

    if (error) throw error;
    
    // 4. Map database snake_case to frontend camelCase.
    const testsWithCamelCase = data.map(test => {
        if (!test.questions) {
            return test;
        }
        return {
            ...test,
            questions: test.questions.map((q: any) => {
                const { comprehension_questions, sample_answer, ...rest } = q;
                const newQ: any = { ...rest };
                if (sample_answer) newQ.sampleAnswer = sample_answer;
                if (comprehension_questions) {
                    newQ.comprehensionQuestions = comprehension_questions.map((cq: any) => {
                        const { sample_answer: cqSampleAnswer, ...cqRest } = cq;
                        const newCq: any = { ...cqRest };
                        if (cqSampleAnswer) newCq.sampleAnswer = cqSampleAnswer;
                        return newCq;
                    });
                }
                return newQ;
            }),
        };
    });

    return new Response(JSON.stringify(testsWithCamelCase), {
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
