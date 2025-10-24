
import { supabase, supabaseAnonKey } from './supabase';
import type { Question, EvaluationResult } from '../types';

/**
 * IMPORTANT: This file calls Supabase Edge Functions.
 * You must create these functions in your Supabase project.
 * Each function should securely retrieve the Gemini API key from Supabase secrets,
 * construct a prompt, call the Gemini API, and return the response.
 * This approach ensures your Gemini API key is never exposed to the client.
 */
export const aiService = {
  async evaluateTest(questions: Question[], answers: (string | Record<number, string>)[]): Promise<EvaluationResult> {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error(sessionError?.message || 'User is not authenticated.');
    }

    // Call the 'clever-endpoint' function for test evaluation.
    const functionName = 'clever-endpoint';
    const { data, error } = await supabase.functions.invoke(functionName, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ questions, answers }),
    });

    if (error) {
      console.error(`Error invoking Supabase function '${functionName}':`, error);
      throw new Error(`AI evaluation service failed: ${error.message}`);
    }

    if (!data) {
        throw new Error('AI evaluation returned no data.');
    }
    
    let evaluationData: EvaluationResult;

    if (typeof data === 'string') {
        try {
            const cleanedString = data.replace(/^```json\s*|```$/g, '').trim();
            evaluationData = JSON.parse(cleanedString);
        } catch (parseError) {
            console.error('Failed to parse AI response as JSON:', parseError, 'Raw response:', data);
            throw new Error('AI returned an invalid response format. Please try submitting again.');
        }
    } else {
        evaluationData = data;
    }
    
    if (evaluationData.questionScores && evaluationData.questionScores.length === questions.length) {
      const totalAwardedMarks = evaluationData.questionScores.reduce((sum, score) => sum + score.score, 0);
      
      const totalPossibleMarks = questions.reduce((total, q) => {
        if (q.type === 'reading-comprehension' && q.comprehensionQuestions) {
          return total + q.comprehensionQuestions.reduce((compTotal, compQ) => compTotal + (compQ.marks || 0), 0);
        }
        return total + (q.marks || 0);
      }, 0);

      evaluationData.overallScore = totalPossibleMarks > 0
        ? Math.round((totalAwardedMarks / totalPossibleMarks) * 100)
        : 0;

      evaluationData.questionScores = evaluationData.questionScores.map((qScore, index) => {
        const question = questions[index];
        let maxMarks = question.marks;

        if (question.type === 'reading-comprehension' && question.comprehensionQuestions) {
          maxMarks = question.comprehensionQuestions.reduce((sum, cq) => sum + (cq.marks || 0), 0);
        }

        const percentage = maxMarks > 0 ? Math.round((qScore.score / maxMarks) * 100) : 0;
        
        return { ...qScore, score: percentage };
      });
    }

    return evaluationData;
  },

  /**
   * Generates a test using AI.
   * This function calls different Supabase endpoints based on whether 'Thinking Mode' is enabled.
   * 'gemini-test-generation-pro' should use gemini-2.5-pro with a thinkingBudget.
   * 'gemini-test-generation-flash' should use a faster model like gemini-flash-latest.
   */
  async generateTestWithAI(params: {
    topic: string;
    numQuestions: number;
    questionTypes: string[];
    difficulty: string;
    isThinkingMode: boolean;
  }): Promise<{ title: string; questions: Question[] }> {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error(sessionError?.message || 'User is not authenticated.');
    }

    const functionName = params.isThinkingMode ? 'gemini-test-generation-pro' : 'gemini-test-generation-flash';
    const { data, error } = await supabase.functions.invoke(functionName, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (error) {
      console.error(`Error invoking Supabase function '${functionName}':`, error);
      throw new Error(`AI test generation service failed: ${error.message}`);
    }

    if (!data || !data.questions) {
      throw new Error('AI test generation returned invalid data. Please ensure the AI returns a { title: string, questions: [] } object.');
    }
    
    return data;
  },
  
  /**
   * Regenerates a single question using AI.
   * This calls a 'gemini-regenerate-question-flash' edge function for speed.
   */
  async regenerateQuestionWithAI(question: Question): Promise<Question> {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error(sessionError?.message || 'User is not authenticated.');
    }

    const functionName = 'gemini-regenerate-question-flash';
    const { data, error } = await supabase.functions.invoke(functionName, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    });

    if (error) {
      console.error(`Error invoking Supabase function '${functionName}':`, error);
      throw new Error(`AI question regeneration failed: ${error.message}`);
    }

    if (!data || !data.type || !data.text) {
      throw new Error('AI question regeneration returned invalid data.');
    }
    
    return data;
  },

  /**
   * Gets a response from the AI Tutor.
   * This calls a 'gemini-tutor-flash' edge function, which should be configured to use a fast,
   * low-latency model like gemini-2.5-flash-lite for responsive chat.
   */
  async getTutorResponse(prompt: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]): Promise<{text: string}> {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error(sessionError?.message || 'User is not authenticated.');
    }

    const functionName = 'gemini-tutor-flash';
    const { data, error } = await supabase.functions.invoke(functionName, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, history }),
    });

    if (error) {
      console.error(`Error invoking Supabase function '${functionName}':`, error);
      throw new Error(`AI tutor service failed: ${error.message}`);
    }

    if (!data || typeof data.text !== 'string') {
        throw new Error('AI tutor returned invalid data.');
    }
    
    return data;
  }
};