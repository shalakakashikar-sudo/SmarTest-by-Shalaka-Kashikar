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

    // 2. Get test payload from body
    const test = await req.json();
    if (!test || !test.title || !test.questions) {
        return new Response(JSON.stringify({ error: 'Invalid test payload.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // 3. Create admin client to perform database operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    let savedTestData;

    if (test.id) { // UPDATE MODE
      // SECURITY CHECK: Verify ownership before updating
      const { data: existingTest, error: fetchError } = await adminClient.from('tests').select('created_by').eq('id', test.id).single();
      if (fetchError) throw new Error(`Could not find test to update: ${fetchError.message}`);
      
      // An admin can edit any test, a teacher must be the owner.
      if (role !== 'admin' && existingTest.created_by !== user.id) {
        return new Response(JSON.stringify({ error: 'Permission denied. You do not own this test.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Proceed with update logic
      const { data: testData, error: testError } = await adminClient
        .from('tests')
        .update({ title: test.title, class: test.class, timer: test.timer, total_marks: test.total_marks, total_questions: test.questions.length })
        .eq('id', test.id)
        .select()
        .single();
      if (testError) throw testError;

      await adminClient.from('questions').delete().eq('test_id', test.id);
      
      const questionsToInsert = test.questions.map((q: any) => {
        const { id, comprehensionQuestions, sampleAnswer, ...questionData } = q;
        const newQ: any = { ...questionData, test_id: test.id };
        if (sampleAnswer) newQ.sample_answer = sampleAnswer;
        if (comprehensionQuestions) {
            newQ.comprehension_questions = comprehensionQuestions.map((cq: any) => {
                const { sampleAnswer: cqSampleAnswer, ...cqRest } = cq;
                const newCq: any = { ...cqRest };
                if (cqSampleAnswer) newCq.sample_answer = cqSampleAnswer;
                return newCq;
            });
        }
        return newQ;
      });

      const { error: questionsError } = await adminClient.from('questions').insert(questionsToInsert);
      if (questionsError) throw questionsError;
      
      savedTestData = { ...testData, questions: test.questions };

    } else { // CREATE MODE
      // Proceed with create logic
      const { data: testData, error: testError } = await adminClient
        .from('tests')
        .insert({ title: test.title, class: test.class, timer: test.timer, total_marks: test.total_marks, created_by: user.id, total_questions: test.questions.length })
        .select()
        .single();
      if (testError) throw testError;
      
      const questionsToInsert = test.questions.map((q: any) => {
        const { comprehensionQuestions, sampleAnswer, ...rest } = q;
        const newQ: any = { ...rest, test_id: testData.id };
        if (sampleAnswer) newQ.sample_answer = sampleAnswer;
        if (comprehensionQuestions) {
            newQ.comprehension_questions = comprehensionQuestions.map((cq: any) => {
                const { sampleAnswer: cqSampleAnswer, ...cqRest } = cq;
                const newCq: any = { ...cqRest };
                if (cqSampleAnswer) newCq.sample_answer = cqSampleAnswer;
                return newCq;
            });
        }
        return newQ;
      });

      const { error: questionsError } = await adminClient.from('questions').insert(questionsToInsert);
      if (questionsError) {
        await adminClient.from('tests').delete().eq('id', testData.id); // Rollback on failure
        throw questionsError;
      }

      const questionsWithId = test.questions.map((q: any) => ({ ...q, test_id: testData.id }));
      savedTestData = { ...testData, questions: questionsWithId };
    }

    return new Response(JSON.stringify(savedTestData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in save-test function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});