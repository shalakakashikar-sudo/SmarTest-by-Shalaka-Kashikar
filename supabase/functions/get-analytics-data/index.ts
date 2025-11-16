
// supabase/functions/get-analytics-data/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Test, TestResult, Question, QuestionScore, EvaluationResult } from '../../../types.ts';

const corsHeaders = {
  'Access-control-allow-origin': '*',
  'Access-control-allow-methods': 'POST, OPTIONS',
  'Access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

declare const Deno: any;

function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Function failed: Missing required environment variable "${key}".`);
  }
  return value;
}

interface QuestionStats {
    totalSuccessRate: number;
    count: number;
    questionText: string;
    testTitle: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    const authorization = req.headers.get('Authorization');
    if (!authorization) throw new Error('Missing authorization header.');
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Authentication failed.');
    
    const { role } = user.user_metadata;
    if (role !== 'teacher' && role !== 'admin') throw new Error('Permission denied.');
    
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: tests, error: testsError } = await adminClient
        .from('tests')
        .select('id, title, created_at, class, questions (*)')
        .eq('created_by', user.id);
    if (testsError) throw testsError;

    if (!tests || tests.length === 0) {
        return new Response(JSON.stringify({ overallStats: { averageScore: 0, totalSubmissions: 0, testCount: 0 }, performanceByTest: [], mostDifficultQuestions: [], performanceTrend: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    const testIds = tests.map(t => t.id);
    const { data: submissions, error: submissionsError } = await adminClient
        .from('test_results')
        .select('test_id, evaluation, submitted_at')
        .in('test_id', testIds);
    if (submissionsError) throw submissionsError;
    
    if (!submissions || submissions.length === 0) {
        return new Response(JSON.stringify({ overallStats: { averageScore: 0, totalSubmissions: 0, testCount: tests.length }, performanceByTest: [], mostDifficultQuestions: [], performanceTrend: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    const testMap = new Map(tests.map(t => [t.id, t]));
    const questionStats = new Map<string, QuestionStats>();

    let totalScoreSum = 0;

    for (const sub of submissions) {
        totalScoreSum += sub.evaluation.overallScore;
        // FIX: Cast the retrieved test to the 'Test' type to resolve property access errors.
        const test = testMap.get(sub.test_id) as Test;
        if (test && test.questions) {
            sub.evaluation.questionScores.forEach((qScore: QuestionScore, index: number) => {
                const question = test.questions[index];
                if (question && question.id && qScore.maxMarks && qScore.maxMarks > 0) {
                    const successRate = (qScore.score / qScore.maxMarks) * 100;
                    const stats = questionStats.get(question.id) || {
                        totalSuccessRate: 0,
                        count: 0,
                        questionText: question.text,
                        testTitle: test.title,
                    };
                    stats.totalSuccessRate += successRate;
                    stats.count += 1;
                    questionStats.set(question.id, stats);
                }
            });
        }
    }

    const overallStats = {
        averageScore: totalScoreSum / submissions.length,
        totalSubmissions: submissions.length,
        testCount: tests.length
    };

    const performanceByTest = tests.map(test => {
        const testSubmissions = submissions.filter(s => s.test_id === test.id);
        if (testSubmissions.length === 0) {
            return { testTitle: test.title, averageScore: 0, submissionCount: 0 };
        }
        const avg = testSubmissions.reduce((acc, curr) => acc + curr.evaluation.overallScore, 0) / testSubmissions.length;
        return { testTitle: test.title, averageScore: avg, submissionCount: testSubmissions.length };
    }).sort((a, b) => b.averageScore - a.averageScore);

    const mostDifficultQuestions = Array.from(questionStats.values()).map(stats => ({
        ...stats,
        averageSuccessRate: stats.totalSuccessRate / stats.count,
    })).sort((a, b) => a.averageSuccessRate - b.averageSuccessRate);
    
    const performanceTrend = tests
      .map(test => {
        const testSubmissions = submissions.filter(s => s.test_id === test.id);
        if (testSubmissions.length === 0) return null;
        const avg = testSubmissions.reduce((acc, curr) => acc + curr.evaluation.overallScore, 0) / testSubmissions.length;
        return {
            date: test.created_at,
            testTitle: test.title,
            averageScore: avg
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const analyticsData = {
        overallStats,
        performanceByTest,
        mostDifficultQuestions,
        performanceTrend,
    };

    return new Response(JSON.stringify(analyticsData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-analytics-data function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
