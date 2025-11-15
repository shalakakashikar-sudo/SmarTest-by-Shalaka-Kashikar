

import { supabase } from './supabase';
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
      body: { questions, answers },
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
      // The AI returns raw scores, so we can sum them up.
      const totalAwardedMarks = evaluationData.questionScores.reduce((sum, score) => sum + (score.score || 0), 0);
      
      const totalPossibleMarks = questions.reduce((total, q) => {
        if (q.type === 'reading-comprehension' && q.comprehensionQuestions) {
          return total + q.comprehensionQuestions.reduce((compTotal, compQ) => compTotal + (compQ.marks || 0), 0);
        }
        return total + (q.marks || 0);
      }, 0);

      // Attach raw and total marks to the main object
      evaluationData.totalAwardedMarks = totalAwardedMarks;
      evaluationData.totalPossibleMarks = totalPossibleMarks;

      // Calculate the overall percentage score
      evaluationData.overallScore = totalPossibleMarks > 0
        ? Math.round((totalAwardedMarks / totalPossibleMarks) * 100)
        : 0;

      // Add maxMarks to each question score, keeping the raw awarded score.
      evaluationData.questionScores = evaluationData.questionScores.map((qScore, index) => {
        const question = questions[index];
        let maxMarks = question.marks;

        if (question.type === 'reading-comprehension' && question.comprehensionQuestions) {
          maxMarks = question.comprehensionQuestions.reduce((sum, cq) => sum + (cq.marks || 0), 0);
        }
        
        return { ...qScore, maxMarks: maxMarks };
      });
    }


    return evaluationData;
  },
};