import { supabase } from './supabase';
import type { Test, TestResult, EvaluationResult } from '../types';

export const dataService = {
  async createTest(test: Test) {
    const { data, error } = await supabase.functions.invoke('save-test', {
      body: test,
    });

    if (error) throw error;
    return data;
  },

  async updateTest(test: Test) {
    if (!test.id) throw new Error("Test ID is required for updating.");
    const { data, error } = await supabase.functions.invoke('save-test', {
      body: test,
    });

    if (error) throw error;
    return data;
  },

  async deleteTest(testId: string) {
    // FIX: Invoke a secure edge function to delete the test.
    // This uses the service_role_key to bypass RLS policies that were
    // causing "permission denied for table users" errors. The function
    // includes its own security checks for ownership.
    const { error } = await supabase.functions.invoke('delete-test', {
      body: { testId },
    });
    if (error) throw error;
    return true;
  },

  async getTests() {
    // FIX: Invoke a secure edge function to fetch all tests.
    // This bypasses the RLS policy that caused "permission denied" errors
    // when loading the dashboard. The data mapping logic is now also
    // handled inside the edge function.
    const { data, error } = await supabase.functions.invoke('get-tests');
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
    const { data, error } = await supabase.functions.invoke('get-submissions', {
      body: { testId },
    });
    
    if (error) {
      // Supabase edge function errors can be tricky. The real error message
      // from the function's Response object often gets wrapped.
      // We will throw the original error message, which is now controlled by our edge function
      // and will be more informative than a generic RLS error.
      throw error;
    }

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
