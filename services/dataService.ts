import { supabase } from './supabase';
import type { Test, TestResult, EvaluationResult } from '../types';

export const dataService = {
  async createTest(test: Test) {
    const { data: testData, error: testError } = await supabase
      .from('tests')
      .insert({
        title: test.title,
        class: test.class,
        timer: test.timer,
        total_marks: test.total_marks,
        created_by: test.created_by,
        total_questions: test.questions.length
      })
      .select()
      .single();

    if (testError) throw testError;

    const questionsToInsert = test.questions.map(q => ({ ...q, test_id: testData.id }));
    const { error: questionsError } = await supabase
      .from('questions')
      .insert(questionsToInsert);

    if (questionsError) {
      // Rollback test creation if questions fail
      await supabase.from('tests').delete().eq('id', testData.id);
      throw questionsError;
    }
    
    return { ...testData, questions: questionsToInsert };
  },

  async updateTest(test: Test) {
    if (!test.id) throw new Error("Test ID is required for updating.");

    const { data: testData, error: testError } = await supabase
      .from('tests')
      .update({
        title: test.title,
        class: test.class,
        timer: test.timer,
        total_marks: test.total_marks,
        total_questions: test.questions.length
      })
      .eq('id', test.id)
      .select()
      .single();
    
    if (testError) throw testError;

    // Easiest way to handle question updates is to delete all old ones and insert the new set.
    const { error: deleteError } = await supabase
      .from('questions')
      .delete()
      .eq('test_id', test.id);
    
    if (deleteError) throw deleteError;

    // FIX: Explicitly remove the 'id' property from questions before re-inserting.
    // This prevents a "not-null constraint" violation by ensuring the database
    // generates a new UUID for each question row.
    const questionsToInsert = test.questions.map(q => {
        const { id, ...questionData } = q;
        return { ...questionData, test_id: test.id };
    });
    
    const { error: questionsError } = await supabase
      .from('questions')
      .insert(questionsToInsert);
    
    if (questionsError) throw questionsError;

    return { ...testData, questions: questionsToInsert };
  },

  async deleteTest(testId: string) {
    // Step 1: Delete associated results to avoid foreign key violations.
    const { error: resultsError } = await supabase
        .from('test_results')
        .delete()
        .eq('test_id', testId);
    if (resultsError) throw resultsError;

    // Step 2: Delete associated questions. (Safer than relying on CASCADE)
    const { error: questionsError } = await supabase
        .from('questions')
        .delete()
        .eq('test_id', testId);
    if (questionsError) throw questionsError;

    // Step 3: Delete the test itself.
    const { error: testError } = await supabase
        .from('tests')
        .delete()
        .eq('id', testId);
    if (testError) throw testError;
    
    return true;
  },

  async getTests() {
    const { data, error } = await supabase
        .from('tests')
        .select(`
            *,
            questions (
                *
            )
        `)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Test[];
  },
  
  async saveTestResult(result: TestResult) {
    const { data, error } = await supabase
        .from('test_results')
        .insert([result])
        .select()
        .single();
    if(error) throw error;
    return data;
  },
  
  async updateTestResult(resultId: string, newEvaluation: EvaluationResult) {
    const { data, error } = await supabase
        .from('test_results')
        .update({ evaluation: newEvaluation })
        .eq('id', resultId)
        .select()
        .single();
    if(error) throw error;
    return data;
  },

  async getTestResults(testId: string) {
    const { data, error } = await supabase
      .from('test_results')
      .select('*')
      .eq('test_id', testId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return data as TestResult[];
  },

  async getMyTestResults(studentId: string) {
    const { data, error } = await supabase
      .from('test_results')
      .select('*')
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return data as TestResult[];
  },

  async deleteTestResult(resultId: string) {
    const { error } = await supabase
      .from('test_results')
      .delete()
      .eq('id', resultId);
    if (error) throw error;
    return true;
  },

  async getUsers() {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error(sessionError?.message || 'User is not authenticated.');
    }

    const { data, error } = await supabase.functions.invoke('admin-get-users');

    if (error) {
      console.error(`Error invoking Supabase function 'admin-get-users':`, error);
      throw new Error(`Failed to load users: ${error.message}`);
    }
    
    return data;
  },

  async deleteUser(userId: string) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error(sessionError?.message || 'User is not authenticated.');
    }

    const { error } = await supabase.functions.invoke('admin-delete-user', {
      body: { userId },
    });

    if (error) {
      console.error(`Error invoking Supabase function 'admin-delete-user':`, error);
      throw new Error(`User deletion failed: ${error.message}`);
    }
    
    return true;
  },
};
