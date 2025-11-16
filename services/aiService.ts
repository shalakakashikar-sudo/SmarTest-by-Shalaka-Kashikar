import { supabase } from './supabase';
import { functionService } from './functionService';
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

    // Call the 'clever-endpoint' function for test evaluation using the centralized service.
    const data = await functionService.invoke('clever-endpoint', {
      questions, answers
    });
    
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
        // FIX: Corrected property access from `comprehensionQuestions` to `comprehension_questions` to match the `Question` type.
        if (q.type === 'reading-comprehension' && q.comprehension_questions) {
          return total + q.comprehension_questions.reduce((compTotal, compQ) => compTotal + (compQ.marks || 0), 0);
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

        // FIX: Corrected property access from `comprehensionQuestions` to `comprehension_questions` to match the `Question` type.
        if (question.type === 'reading-comprehension' && question.comprehension_questions) {
          maxMarks = question.comprehension_questions.reduce((sum, cq) => sum + (cq.marks || 0), 0);
        }
        
        return { ...qScore, maxMarks: maxMarks };
      });
    }


    return evaluationData;
  },
};
